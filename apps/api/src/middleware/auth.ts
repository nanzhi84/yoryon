/**
 * Bearer 会话认证（ADR-0001/§9.3）。
 * - API 只认 Authorization: Bearer，不认 Cookie；
 * - 联查 users.status：禁用用户即时失效；
 * - 30 天滑动过期：剩余 <15 天时续期，并经 X-Session-Expires 响应头通知 BFF 重设 Cookie。
 */
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { sessions, users, type Database } from "@yoryon/db";
import { SESSION_RENEW_BELOW_MS, SESSION_TOUCH_MIN_INTERVAL_MS, SESSION_TTL_MS } from "@yoryon/config";
import { hashSessionToken, type AccessUser } from "@yoryon/core";
import type { Context, Next } from "hono";
import { errorResponse } from "../errors";

export interface AuthSession {
  user: AccessUser & { email: string; username: string; status: string };
  sessionId: string;
}

export type AppVariables = {
  requestId: string;
  clientIp: { ip: string; source: "bff" | "direct" | "unknown" };
  auth: AuthSession | null;
  sessionRenewedExpiresAt: Date | null;
};

export function authMiddleware(db: Database) {
  return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    c.set("auth", null);
    c.set("sessionRenewedExpiresAt", null);
    // 公开线和匿名分析不执行 session 查询/续期；公开 DTO 不能随身份变化。
    if (/^\/api\/(?:public\/|feed$|tags$|tags\/|collections$|sitemap$|cache\/|analytics\/events$)/.test(c.req.path)) { await next(); return; }
    const header = c.req.header("authorization");
    if (header?.startsWith("Bearer ")) {
      const token = header.slice("Bearer ".length).trim();
      const tokenHash = hashSessionToken(token);
      const now = new Date();
      const rows = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);
      const row = rows[0];
      if (row && row.user.status === "active") {
        c.set("auth", {
          user: { id: row.user.id, role: row.user.role, email: row.user.email, username: row.user.username, status: row.user.status },
          sessionId: row.session.id,
        });
        // 滑动续期（续期必写，同时刷新 lastUsedAt）
        const remaining = row.session.expiresAt.getTime() - now.getTime();
        if (remaining < SESSION_RENEW_BELOW_MS) {
          const newExpires = new Date(now.getTime() + SESSION_TTL_MS);
          await db.update(sessions).set({ expiresAt: newExpires, lastUsedAt: now }).where(eq(sessions.id, row.session.id));
          c.set("sessionRenewedExpiresAt", newExpires);
        } else {
          // lastUsedAt 条件写入：距上次记录超过阈值才写，保留登录活动记录同时消除高频写放大（F05a）。
          // 应用层预检跳过窗口内的 UPDATE 语句；阈值条件同时下沉到 WHERE，并发请求在窗口边界
          // 同读旧值时由数据库对更新后的行重判，抑制并发重复写
          const lastUsed = row.session.lastUsedAt;
          if (!lastUsed || now.getTime() - lastUsed.getTime() >= SESSION_TOUCH_MIN_INTERVAL_MS) {
            const touchCutoff = new Date(now.getTime() - SESSION_TOUCH_MIN_INTERVAL_MS);
            await db
              .update(sessions)
              .set({ lastUsedAt: now })
              .where(and(eq(sessions.id, row.session.id), or(isNull(sessions.lastUsedAt), lte(sessions.lastUsedAt, touchCutoff))));
          }
        }
      }
    }
    await next();
    // 通知 BFF 重设 Cookie（滑动续期）
    const renewed = c.get("sessionRenewedExpiresAt");
    if (renewed) c.header("x-session-expires", renewed.toISOString());
  };
}

export function requireAuth(c: Context<{ Variables: AppVariables }>): AuthSession | Response {
  const auth = c.get("auth");
  if (!auth) return errorResponse(c, 401, "unauthorized", "需要登录");
  return auth;
}
