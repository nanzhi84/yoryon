import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { entitlements, memberQuestions, type Database } from "@yoryon/db";
type Tx = Pick<Database, "select">;

export function monthKeyShanghai(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}

/** 只认有效 subscription；单篇和合集权益不授予问答资格。 */
export async function hasActiveSubscription(tx: Tx, userId: string, now: Date): Promise<boolean> {
  const rows = await tx.select({ id: entitlements.id }).from(entitlements).where(and(
    eq(entitlements.userId, userId), eq(entitlements.scopeType, "subscription"), isNull(entitlements.revokedAt),
    lte(entitlements.validFrom, now), or(isNull(entitlements.validUntil), gt(entitlements.validUntil, now)),
  )).limit(1);
  return rows.length > 0;
}

/** 展示连续订阅链的实际到期时间，包含已兑换且紧接当前权益的续订区间。 */
export async function subscriptionValidUntil(tx: Tx, userId: string, now: Date): Promise<Date | null | undefined> {
  const rows = await tx.select({ from: entitlements.validFrom, until: entitlements.validUntil }).from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.scopeType, "subscription"), isNull(entitlements.revokedAt)))
    .orderBy(entitlements.validFrom);
  let until: Date | undefined;
  for (const r of rows) {
    if (r.from > (until ?? now)) break;
    if (r.until === null) return null;
    if (r.until > (until ?? now)) until = r.until;
  }
  return until;
}

export async function remainingQuestionQuota(tx: Tx, userId: string, now: Date): Promise<number | null> {
  if (!(await hasActiveSubscription(tx, userId, now))) return null;
  const rows = await tx.select({ id: memberQuestions.id }).from(memberQuestions)
    .where(and(eq(memberQuestions.userId, userId), eq(memberQuestions.monthKey, monthKeyShanghai(now)))).limit(1);
  return rows.length ? 0 : 1;
}
