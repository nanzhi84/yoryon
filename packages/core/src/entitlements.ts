/**
 * 统一权益模型（ADR-0002）——canAccess 唯一实现 + 兑换事务。
 *
 * - 三种付费形态（content/collection/subscription）共用 entitlements 表与区间覆盖判断；
 * - 订阅区间链：base = max(now, 未撤销订阅 max(valid_until))；
 * - 兑换幂等：(code_id, user_id) 唯一约束兜底，重复兑换返回幂等成功；
 * - 防超发：条件更新 used_count < max_uses；
 * - 并发串行化：先锁用户行（串行化同一用户所有兑换），再锁码行。
 */
import { and, eq, gt, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import {
  activationCodes,
  collectionItems,
  collections,
  contents,
  entitlements,
  redemptions,
  users,
  type Content,
  type Entitlement,
  type Redemption,
  type User,
} from "@yoryon/db";
import type { Database } from "@yoryon/db";

type Tx = Pick<Database, "select" | "insert" | "update">;

export interface AccessUser {
  id: string;
  role: "admin" | "user";
}

/**
 * 统一权益校验（架构 §6.1）。
 * 注意：调用方需保证 content 已按 status='published' 过滤（草稿对外不可见）。
 */
export async function canAccess(tx: Tx, user: AccessUser | null, content: Pick<Content, "id" | "visibility">, now: Date): Promise<boolean> {
  if (content.visibility === "public") return true;
  if (!user) return false;
  if (user.role === "admin") return true;

  const collectionCovers: SQL = sql`exists (
    select 1 from ${collectionItems} ci
    where ci.collection_id = ${entitlements.scopeId} and ci.content_id = ${content.id}
  )`;

  const rows = await tx
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, user.id),
        isNull(entitlements.revokedAt),
        lte(entitlements.validFrom, now),
        or(isNull(entitlements.validUntil), gt(entitlements.validUntil, now)),
        or(
          and(eq(entitlements.scopeType, "content"), eq(entitlements.scopeId, content.id)),
          and(eq(entitlements.scopeType, "collection"), collectionCovers),
          eq(entitlements.scopeType, "subscription"),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type RedeemError =
  | "invalid_code"
  | "code_disabled"
  | "code_expired"
  | "code_exhausted"
  | "grant_target_invalid";

export type RedeemResult =
  | { ok: true; idempotent: boolean; redemption: Redemption; entitlement: Entitlement }
  | { ok: false; error: RedeemError };

/** 计算订阅新区间的 base：max(now, 未撤销订阅权益的 max(valid_until))；存在永久权益时 base=now。 */
async function subscriptionBase(tx: Tx, userId: string, now: Date): Promise<Date> {
  const rows = await tx
    .select({ validUntil: entitlements.validUntil })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.scopeType, "subscription"), isNull(entitlements.revokedAt)));
  let maxUntil: Date | null = null;
  for (const r of rows) {
    if (r.validUntil === null) return now; // 已有永久权益：新区间仅作事实记录
    if (maxUntil === null || r.validUntil > maxUntil) maxUntil = r.validUntil;
  }
  return maxUntil !== null && maxUntil > now ? maxUntil : now;
}

async function insertEntitlementForCode(
  tx: Tx,
  code: typeof activationCodes.$inferSelect,
  redemptionId: string,
  userId: string,
  now: Date,
): Promise<Entitlement> {
  let validFrom = now;
  let validUntil: Date | null;
  if (code.grantType === "subscription") {
    const base = await subscriptionBase(tx, userId, now);
    validFrom = base;
    validUntil = new Date(base.getTime() + code.grantDays! * 24 * 60 * 60 * 1000);
  } else {
    validUntil = code.grantDays === null ? null : new Date(now.getTime() + code.grantDays * 24 * 60 * 60 * 1000);
  }
  const scopeId = code.grantType === "content" ? code.grantContentId : code.grantType === "collection" ? code.grantCollectionId : null;
  const inserted = await tx
    .insert(entitlements)
    .values({
      userId,
      scopeType: code.grantType,
      scopeId,
      validFrom,
      validUntil,
      redemptionId,
    })
    .returning();
  return inserted[0]!;
}

/**
 * 激活码兑换（ADR-0002 事务剧本）。db 必须支持事务（非单连接 lock client）。
 */
export async function redeemCode(db: Database, params: { userId: string; code: string; now?: Date }): Promise<RedeemResult> {
  const now = params.now ?? new Date();
  const normalizedCode = params.code.trim();

  try {
    return await db.transaction(async (tx) => {
      // 1. 锁用户行：串行化同一用户的所有兑换（不同码并发不丢订阅有效期）
      const userRows = await tx.select({ id: users.id }).from(users).where(eq(users.id, params.userId)).for("update");
      if (userRows.length === 0) return { ok: false as const, error: "invalid_code" as const }; // 不应发生（登录用户）

      // 2. 锁码行：串行化同一码的并发兑换
      const codeRows = await tx.select().from(activationCodes).where(eq(activationCodes.code, normalizedCode)).for("update");
      const code = codeRows[0];
      if (!code) return { ok: false as const, error: "invalid_code" as const };
      if (code.status !== "active") return { ok: false as const, error: "code_disabled" as const };
      if (code.expiresAt !== null && code.expiresAt <= now) return { ok: false as const, error: "code_expired" as const };

      // 3. 校验 grant 引用仍然有效
      if (code.grantType === "content") {
        const c = await tx.select({ id: contents.id }).from(contents).where(eq(contents.id, code.grantContentId!));
        if (c.length === 0) return { ok: false as const, error: "grant_target_invalid" as const };
      } else if (code.grantType === "collection") {
        const coll = await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, code.grantCollectionId!)).limit(1);
        if (coll.length === 0) return { ok: false as const, error: "grant_target_invalid" as const };
      }

      // 4. 幂等：先查重
      const existing = await tx
        .select()
        .from(redemptions)
        .where(and(eq(redemptions.codeId, code.id), eq(redemptions.userId, params.userId)))
        .limit(1);
      if (existing.length > 0) {
        const ent = await tx.select().from(entitlements).where(eq(entitlements.redemptionId, existing[0]!.id)).limit(1);
        return { ok: true as const, idempotent: true, redemption: existing[0]!, entitlement: ent[0]! };
      }

      // 5. 条件更新防超发
      const bumped = await tx
        .update(activationCodes)
        .set({ usedCount: sql`${activationCodes.usedCount} + 1` })
        .where(and(eq(activationCodes.id, code.id), sql`${activationCodes.usedCount} < ${code.maxUses}`))
        .returning({ id: activationCodes.id });
      if (bumped.length === 0) return { ok: false as const, error: "code_exhausted" as const };

      // 6. 插入 redemption + entitlement
      const red = await tx.insert(redemptions).values({ codeId: code.id, userId: params.userId }).returning();
      const entitlement = await insertEntitlementForCode(tx, code, red[0]!.id, params.userId, now);
      return { ok: true as const, idempotent: false, redemption: red[0]!, entitlement };
    });
  } catch (err: unknown) {
    // 唯一约束 (code_id, user_id) 兜底：并发下另一事务已提交 → 幂等成功
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      const codeRows = await db.select().from(activationCodes).where(eq(activationCodes.code, normalizedCode)).limit(1);
      const code = codeRows[0];
      if (code) {
        const existing = await db
          .select()
          .from(redemptions)
          .where(and(eq(redemptions.codeId, code.id), eq(redemptions.userId, params.userId)))
          .limit(1);
        if (existing.length > 0) {
          const ent = await db.select().from(entitlements).where(eq(entitlements.redemptionId, existing[0]!.id)).limit(1);
          if (ent[0]) return { ok: true, idempotent: true, redemption: existing[0]!, entitlement: ent[0] };
        }
      }
    }
    throw err;
  }
}

/** 撤销单笔权益：单调状态字段 NULL → 值，不可逆（ADR-0002）。 */
export async function revokeEntitlement(
  db: Database,
  params: { entitlementId: string; revokedBy: string | null; reason: string; now?: Date },
): Promise<Entitlement | null> {
  const now = params.now ?? new Date();
  const rows = await db
    .update(entitlements)
    .set({ revokedAt: now, revokedBy: params.revokedBy, revokeReason: params.reason })
    .where(and(eq(entitlements.id, params.entitlementId), isNull(entitlements.revokedAt)))
    .returning();
  return rows[0] ?? null;
}

export interface EntitlementView {
  entitlement: Entitlement;
  scopeTitle: string | null;
}

/** 用户权益列表（含 scope 标题，/api/me/entitlements 与 CLI 共用查询形状）。 */
export async function listUserEntitlements(db: Database, userId: string): Promise<EntitlementView[]> {
  const rows = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).orderBy(entitlements.createdAt);
  const views: EntitlementView[] = [];
  for (const e of rows) {
    let scopeTitle: string | null = null;
    if (e.scopeType === "content" && e.scopeId) {
      const c = await db.select({ title: contents.title }).from(contents).where(eq(contents.id, e.scopeId)).limit(1);
      scopeTitle = c[0]?.title ?? null;
    } else if (e.scopeType === "collection" && e.scopeId) {
      const c = await db.select({ title: collections.title }).from(collections).where(eq(collections.id, e.scopeId)).limit(1);
      scopeTitle = c[0]?.title ?? null;
    } else {
      scopeTitle = "全站订阅";
    }
    views.push({ entitlement: e, scopeTitle });
  }
  return views;
}

export type { User };
