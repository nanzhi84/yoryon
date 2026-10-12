/**
 * 会员问答领域逻辑（Issue #15）：知识星球式公共问答。
 * - 提问资格：仅当前有效订阅权益（scope_type='subscription'；单篇/合集授权不算；admin 是回答者而非提问者）。
 * - 月度配额：每自然月（Asia/Shanghai）1 问，唯一索引 (user_id, month_key) 兜底并发；不累积、续订不重复发放。
 * - 可见性：公开问答的问题全员可读；回答仅有效订阅会员与提问者本人可读；私密问答仅提问者与管理员（CLI）可见。
 */
import { and, eq } from "drizzle-orm";
import { entitlements, memberQuestions, notifications, users, type Database, type MemberQuestion } from "@yoryon/db";
import { deterministicUuid } from "./notification-events";
import { hasActiveSubscription, monthKeyShanghai } from "./membership";
import type { AccessUser } from "./entitlements";

type Tx = Pick<Database, "select" | "insert" | "update">;

export const QUESTION_MAX_LEN = 500;

export type QuestionError = "invalid_question" | "quota_used" | "forbidden" | "not_found";
export type QuestionResult<T> = { ok: true; value: T } | { ok: false; error: QuestionError };

export function validateQuestionText(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  const len = [...t].length;
  return len >= 1 && len <= QUESTION_MAX_LEN;
}

/**
 * 提交问题：有效订阅 + 月度配额（(user_id, month_key) 唯一索引兜底并发双提）。
 */
export async function askQuestion(
  db: Database,
  params: { user: AccessUser; question: string; visibility: "public" | "private"; now?: Date },
): Promise<QuestionResult<MemberQuestion>> {
  if (!validateQuestionText(params.question)) return { ok: false, error: "invalid_question" };
  const now = params.now ?? new Date();
  try {
    return await db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, params.user.id)).for("update");
    if (!(await hasActiveSubscription(tx, params.user.id, now))) return { ok: false as const, error: "forbidden" as const };
    const inserted = await tx
      .insert(memberQuestions)
      .values({
        userId: params.user.id,
        monthKey: monthKeyShanghai(now),
        question: params.question.trim(),
        visibility: params.visibility,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return { ok: true as const, value: inserted[0]! };
    });
  } catch (err) {
    const pg = (err as { cause?: { code?: string }; code?: string }).cause ?? (err as { code?: string });
    if (pg.code === "23505") return { ok: false, error: "quota_used" };
    throw err;
  }
}

/**
 * 创作者回答（CLI）：pending → answered，同一事务写回答 + 通知提问者（answer 通知，幂等键 answer:<questionId>）。
 * 重复回答用于修正答案文本：更新 answer/updatedAt，不重复通知。
 */
export async function answerQuestion(
  db: Database,
  params: { id: string; answer: string; answeredBy: string; now?: Date },
): Promise<QuestionResult<{ question: MemberQuestion; firstAnswer: boolean }>> {
  if (typeof params.answer !== "string" || !params.answer.trim() || [...params.answer.trim()].length > 20000) return { ok: false, error: "invalid_question" };
  const now = params.now ?? new Date();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(memberQuestions).where(eq(memberQuestions.id, params.id)).limit(1).for("update");
    const q = rows[0];
    if (!q) return { ok: false, error: "not_found" };
    if (q.status === "hidden") return { ok: false, error: "forbidden" }; // 已隐藏不回答
    const firstAnswer = q.status !== "answered";
    const updated = await tx
      .update(memberQuestions)
      .set({ answer: params.answer.trim(), status: "answered", answeredAt: q.answeredAt ?? now, updatedAt: now })
      .where(eq(memberQuestions.id, q.id))
      .returning();
    if (firstAnswer) {
      // 通知提问者（提问者可能是已过期会员——历史问题回答本人可见，通知照常送达）
      const actor = params.answeredBy;
      await tx
        .insert(notifications)
        .values({
          recipientUserId: q.userId,
          actorUserId: actor,
          type: "answer",
          questionId: q.id,
          eventId: deterministicUuid(`answer:${q.id}`),
          createdAt: now,
        })
        .onConflictDoNothing({ target: notifications.eventId });
    }
    return { ok: true, value: { question: updated[0]!, firstAnswer } };
  });
}

/** 隐藏不适当问答（CLI）：任何状态 → hidden；不出现在公开问答流，会员互动由接口层拒绝。 */
export async function hideQuestion(db: Database, params: { id: string; now?: Date }): Promise<QuestionResult<MemberQuestion>> {
  const now = params.now ?? new Date();
  const rows = await db
    .update(memberQuestions)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(memberQuestions.id, params.id))
    .returning();
  return rows[0] ? { ok: true, value: rows[0] } : { ok: false, error: "not_found" };
}
