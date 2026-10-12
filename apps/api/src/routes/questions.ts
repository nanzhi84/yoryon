/** 私有 no-store：公共问题和会员回答分别投影，答案不会进入公共缓存。 */
import { and, desc, eq, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { Hono } from "hono";
import { memberQuestions, users, type MemberQuestion } from "@yoryon/db";
import { askQuestion, hasActiveSubscription, monthKeyShanghai, remainingQuestionQuota, subscriptionValidUntil, toAuthorDto, validateQuestionText } from "@yoryon/core";
import type { AppDeps } from "../deps";
import type { AppVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { errorResponse } from "../errors";
import { checkRate } from "./auth";

export const QUESTION_PAGE_SIZE = 20;
export const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authors = { username: users.username, displayName: users.displayName, avatarMediaId: users.avatarMediaId };
function cursorEncode(t: Date, id: string, version: string) {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id, version })).toString("base64url");
}
function cursorDecode(raw: string | undefined): { t: Date; id: string; version: string } | null {
  if (!raw || raw.length > 512) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const t = new Date(v.t);
    return !Number.isNaN(t.getTime()) && typeof v.id === "string" && uuidRe.test(v.id) && typeof v.version === "string"
      ? { t, id: v.id, version: v.version } : null;
  } catch { return null; }
}
export function questionItem(q: MemberQuestion, author: Parameters<typeof toAuthorDto>[0], viewer: { id: string; role: string } | null, member: boolean) {
  const owner = viewer?.id === q.userId;
  const answerVisible = owner || viewer?.role === "admin" || (q.visibility === "public" && member);
  return {
    id: q.id, question: q.question, status: q.status, visibility: q.visibility,
    createdAt: q.createdAt.toISOString(), answeredAt: q.answeredAt?.toISOString() ?? null,
    author: toAuthorDto(author), own: owner, answer: answerVisible ? q.answer : null,
    answerLocked: q.answer !== null && !answerVisible,
    canDiscuss: q.visibility === "public" && q.status !== "hidden" && (member || viewer?.role === "admin"),
  };
}

export function questionRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  // Hono子应用挂载会展平路由，通配中间件不得覆盖同/api下的头像或其他模块。
  app.use("/questions", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  app.use("/questions/*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  app.use("/me/membership", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  const questionBodyLimit = bodyLimit({ maxSize: 32 * 1024, onError: c => errorResponse(c, 413, "payload_too_large", "请求体过大") });
  for (const scope of ["public", "mine"] as const) {
    app.get(`/questions/${scope}`, async c => {
      const auth = c.get("auth");
      if (scope === "mine" && !auth) return errorResponse(c, 401, "unauthorized", "请先登录");
      const raw = c.req.query("cursor");
      const cursor = cursorDecode(raw);
      if (raw && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效");
      const condition = scope === "mine" ? eq(memberQuestions.userId, auth!.user.id)
        : and(eq(memberQuestions.visibility, "public"), ne(memberQuestions.status, "hidden"))!;
      const member = auth ? await hasActiveSubscription(deps.db, auth.user.id, new Date()) : false;
      return deps.db.transaction(async tx => {
        const versionRow = await tx.select({ version: sql<string>`md5(coalesce(string_agg(${memberQuestions.id}::text || ${memberQuestions.updatedAt}::text || ${memberQuestions.visibility} || ${memberQuestions.status}, ',' order by ${memberQuestions.id}), ''))` })
          .from(memberQuestions).where(condition);
        const version = versionRow[0]!.version;
        if (cursor && cursor.version !== version) return errorResponse(c, 409, "snapshot_expired", "问答有新活动，请刷新列表");
        const conds: SQL[] = [condition];
        if (cursor) conds.push(or(lt(memberQuestions.updatedAt, cursor.t), and(eq(memberQuestions.updatedAt, cursor.t), lt(memberQuestions.id, cursor.id)))!);
        const rows = await tx.select({ q: memberQuestions, author: authors }).from(memberQuestions).innerJoin(users, eq(memberQuestions.userId, users.id))
          .where(and(...conds)).orderBy(desc(memberQuestions.updatedAt), desc(memberQuestions.id)).limit(QUESTION_PAGE_SIZE + 1);
        const page = rows.slice(0, QUESTION_PAGE_SIZE); const last = page.at(-1);
        return c.json({ items: page.map(r => questionItem(r.q, r.author, auth?.user ?? null, member)),
          nextCursor: rows.length > QUESTION_PAGE_SIZE && last ? cursorEncode(last.q.updatedAt, last.q.id, version) : null });
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
    });
  }
  app.get("/questions/:id", async c => {
    const id = c.req.param("id");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "问答不存在");
    const rows = await deps.db.select({ q: memberQuestions, author: authors }).from(memberQuestions).innerJoin(users, eq(memberQuestions.userId, users.id))
      .where(eq(memberQuestions.id, id)).limit(1);
    const row = rows[0]; const viewer = c.get("auth")?.user ?? null;
    if (!row || ((row.q.visibility === "private" || row.q.status === "hidden") && row.q.userId !== viewer?.id && viewer?.role !== "admin"))
      return errorResponse(c, 404, "not_found", "问答不存在");
    const member = viewer ? await hasActiveSubscription(deps.db, viewer.id, new Date()) : false;
    return c.json({ item: questionItem(row.q, row.author, viewer, member) });
  });
  app.post("/questions", questionBodyLimit, async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [{ key: `question:${auth.user.id}`, limit: 5, windowMs: 60_000 }]);
    if (limited) return limited;
    const body = await c.req.json().catch(() => null) as { question?: unknown; visibility?: unknown } | null;
    if (!body || !validateQuestionText(body.question) || (body.visibility !== undefined && body.visibility !== "public" && body.visibility !== "private"))
      return errorResponse(c, 400, "invalid_request", "问题需为 1-500 字，隐私只能是 public 或 private");
    const result = await askQuestion(deps.db, { user: auth.user, question: body.question, visibility: body.visibility === "private" ? "private" : "public" });
    if (!result.ok) return errorResponse(c, result.error === "quota_used" ? 409 : 403, result.error, result.error === "quota_used" ? "本月提问次数已用完" : "提问需要有效订阅");
    return c.json({ item: questionItem(result.value, auth.user, auth.user, true) }, 201);
  });
  app.patch("/questions/:id", questionBodyLimit, async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    if (!uuidRe.test(c.req.param("id"))) return errorResponse(c, 404, "not_found", "问答不存在");
    const body = await c.req.json().catch(() => null) as { visibility?: unknown } | null;
    if (!body || (body.visibility !== "public" && body.visibility !== "private")) return errorResponse(c, 400, "invalid_request", "隐私只能是 public 或 private");
    const rows = await deps.db.update(memberQuestions).set({ visibility: body.visibility, updatedAt: sql`greatest(${memberQuestions.updatedAt}, date_trunc('milliseconds', clock_timestamp()))` })
      .where(and(eq(memberQuestions.id, c.req.param("id")), eq(memberQuestions.userId, auth.user.id), ne(memberQuestions.status, "hidden"))).returning();
    if (!rows[0]) return errorResponse(c, 404, "not_found", "问答不存在或不可修改");
    return c.json({ item: questionItem(rows[0], auth.user, auth.user, false) });
  });
  app.get("/me/membership", async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const now = new Date(); const until = await subscriptionValidUntil(deps.db, auth.user.id, now);
    return c.json({ active: until !== undefined, validUntil: until?.toISOString() ?? null, permanent: until === null,
      questionsRemaining: await remainingQuestionQuota(deps.db, auth.user.id, now), monthKey: monthKeyShanghai(now) });
  });
  return app;
}
