/**
 * 认证路由：注册 / 验证码 / 重发 / 登录 / 登出 / 密码重置 / me（架构 §7、§9）。
 * API 只认 Bearer；Cookie 的设置与清除由 BFF 完成（login/verify-email 返回 token，由 BFF 转 Set-Cookie）。
 */
import { Hono } from "hono";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { emailVerifications, sessions, users } from "@yoryon/db";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_COOLDOWN_MS,
  EMAIL_CODE_TTL_MS,
  RATE_LIMITS,
  SESSION_TTL_MS,
} from "@yoryon/config";
import { generateEmailCode, generateSessionToken, hashEmailCode, hashPassword, verifyPassword } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import type { AppVariables } from "../middleware/auth";
import type { Context } from "hono";

const registerSchema = z.object({
  email: z.email(),
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/, "用户名需为 3-32 位字母/数字/下划线/连字符"),
  password: z.string().min(8, "密码至少 8 位").max(128),
});

const verifySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

const resendSchema = z.object({
  email: z.email(),
  purpose: z.enum(["register", "password_reset"]),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

const resetSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

type Ctx = Context<{ Variables: AppVariables }>;

/** 限流检查：unknown IP 桶阈值减半（ADR-0001 §9.5）。 */
export function checkRate(deps: AppDeps, c: Ctx, buckets: { key: string; limit: number; windowMs: number }[]): Response | null {
  const { ip } = c.get("clientIp");
  const factor = ip === "unknown" ? 0.5 : 1;
  for (const b of buckets) {
    const limit = Math.max(1, Math.floor(b.limit * factor));
    const retryAfter = deps.rateLimiter.consume(b.key, limit, b.windowMs);
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, 429, "rate_limited", "请求过于频繁，请稍后再试");
    }
  }
  return null;
}

async function createSession(deps: AppDeps, c: Ctx, userId: string) {
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await deps.db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
    ip: c.get("clientIp").ip,
    userAgent: c.req.header("user-agent") ?? null,
  });
  return { token, expiresAt };
}

function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, username: u.username, role: u.role };
}

async function issueVerificationCode(deps: AppDeps, email: string, purpose: "register" | "password_reset") {
  // 作废旧码（同 email+purpose 未消费的全部消费掉）
  await deps.db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailVerifications.email, email), eq(emailVerifications.purpose, purpose), isNull(emailVerifications.consumedAt)));
  const { code, codeHash } = generateEmailCode(email, purpose);
  await deps.db.insert(emailVerifications).values({
    email,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
  });
  await deps.mailer.sendVerificationCode(email, code, purpose, deps.env.SITE_URL);
}

type CodeCheck =
  | { ok: true; verificationId: string }
  | { ok: false; status: 400 | 429; code: string; message: string };

async function checkVerificationCode(deps: AppDeps, email: string, purpose: "register" | "password_reset", code: string): Promise<CodeCheck> {
  const rows = await deps.db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, email), eq(emailVerifications.purpose, purpose), isNull(emailVerifications.consumedAt)))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);
  const v = rows[0];
  if (!v) return { ok: false, status: 400, code: "invalid_code", message: "验证码无效或已使用" };
  if (v.expiresAt <= new Date()) return { ok: false, status: 400, code: "code_expired", message: "验证码已过期，请重新获取" };
  if (v.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return { ok: false, status: 429, code: "too_many_attempts", message: "尝试次数过多，请重新获取验证码" };
  if (v.codeHash !== hashEmailCode(email, purpose, code)) {
    await deps.db
      .update(emailVerifications)
      .set({ attempts: v.attempts + 1 })
      .where(eq(emailVerifications.id, v.id));
    return { ok: false, status: 400, code: "invalid_code", message: "验证码错误" };
  }
  return { ok: true, verificationId: v.id };
}

async function consumeVerification(deps: AppDeps, id: string) {
  await deps.db.update(emailVerifications).set({ consumedAt: new Date() }).where(eq(emailVerifications.id, id));
}

export function authRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/register", async (c) => {
    const limited = checkRate(deps, c, [{ key: `register:ip:${c.get("clientIp").ip}`, limit: RATE_LIMITS.registerPerIpPerHour, windowMs: 3600_000 }]);
    if (limited) return limited;
    const body = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", body.error.issues[0]?.message ?? "参数错误");
    const { email, username, password } = body.data;

    const byEmail = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
    const existing = byEmail[0];
    if (existing && existing.status !== "pending") {
      return errorResponse(c, 409, "email_taken", "该邮箱已注册");
    }
    const byUsername = await deps.db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (byUsername[0] && byUsername[0].id !== existing?.id) {
      return errorResponse(c, 409, "username_taken", "该用户名已被使用");
    }

    const passwordHash = await hashPassword(password);
    if (existing) {
      await deps.db.update(users).set({ username, passwordHash, updatedAt: new Date() }).where(eq(users.id, existing.id));
    } else {
      await deps.db.insert(users).values({ email, username, passwordHash });
    }
    await issueVerificationCode(deps, email, "register");
    return c.json({ ok: true });
  });

  app.post("/verify-email", async (c) => {
    const body = verifySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");
    const { email, code } = body.data;

    const userRows = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];
    if (!user || user.status !== "pending") {
      return errorResponse(c, 400, "invalid_code", "验证码无效或账号状态异常");
    }
    const check = await checkVerificationCode(deps, email, "register", code);
    if (!check.ok) return errorResponse(c, check.status, check.code, check.message);
    await consumeVerification(deps, check.verificationId);
    await deps.db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, user.id));

    const session = await createSession(deps, c, user.id);
    return c.json({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: publicUser({ ...user, status: "active" }) });
  });

  app.post("/resend-code", async (c) => {
    const body = resendSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");
    const { email, purpose } = body.data;

    // 60s 重发冷却
    const recent = await deps.db
      .select({ createdAt: emailVerifications.createdAt })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.email, email), eq(emailVerifications.purpose, purpose)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < EMAIL_CODE_RESEND_COOLDOWN_MS) {
      return errorResponse(c, 429, "resend_cooldown", "发送太频繁，请 60 秒后再试");
    }

    // 防枚举：不满足条件也返回 ok，只是不发信
    const userRows = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];
    const applicable =
      (purpose === "register" && user?.status === "pending") || (purpose === "password_reset" && user?.status === "active");
    if (applicable) {
      await issueVerificationCode(deps, email, purpose);
    }
    return c.json({ ok: true });
  });

  app.post("/login", async (c) => {
    const ip = c.get("clientIp").ip;
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");
    const { emailOrUsername, password } = body.data;

    const limited = checkRate(deps, c, [
      { key: `login:ip:${ip}`, limit: RATE_LIMITS.loginPerIpPerMinute, windowMs: 60_000 },
      { key: `login:acct:${emailOrUsername.toLowerCase()}`, limit: RATE_LIMITS.loginPerAccountPer5Min, windowMs: 300_000 },
    ]);
    if (limited) return limited;

    const rows = await deps.db
      .select()
      .from(users)
      .where(or(eq(users.email, emailOrUsername), sql`lower(${users.username}) = lower(${emailOrUsername})`))
      .limit(1);
    const user = rows[0];
    // 用户不存在时也执行一次校验，钝化时间侧信道
    const ok = await verifyPassword(user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password);
    if (!user || !ok) return errorResponse(c, 401, "invalid_credentials", "账号或密码错误");
    if (user.status === "pending") return errorResponse(c, 403, "email_not_verified", "邮箱尚未验证，请先完成验证");
    if (user.status === "disabled") return errorResponse(c, 403, "account_disabled", "账号已被禁用");

    const session = await createSession(deps, c, user.id);
    return c.json({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: publicUser(user) });
  });

  app.post("/logout", async (c) => {
    const auth = c.get("auth");
    if (auth) {
      await deps.db.delete(sessions).where(eq(sessions.id, auth.sessionId));
    }
    return c.json({ ok: true });
  });

  app.post("/password-reset", async (c) => {
    const body = resetSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");
    const { email, code, newPassword } = body.data;
    const ip = c.get("clientIp").ip;

    if (code === undefined && newPassword === undefined) {
      // 阶段一：发码
      const limited = checkRate(deps, c, [
        { key: `pwreset:ip:${ip}`, limit: RATE_LIMITS.passwordResetPerIpPerHour, windowMs: 3600_000 },
        { key: `pwreset:acct:${email.toLowerCase()}`, limit: RATE_LIMITS.passwordResetPerAccountPerHour, windowMs: 3600_000 },
      ]);
      if (limited) return limited;
      const userRows = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
      if (userRows[0]?.status === "active") {
        await issueVerificationCode(deps, email, "password_reset");
      }
      return c.json({ ok: true });
    }

    // 阶段二：重置
    if (!code || !newPassword) return errorResponse(c, 400, "invalid_request", "参数错误");
    const userRows = await deps.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];
    if (!user || user.status !== "active") return errorResponse(c, 400, "invalid_code", "验证码无效或账号状态异常");
    const check = await checkVerificationCode(deps, email, "password_reset", code);
    if (!check.ok) return errorResponse(c, check.status, check.code, check.message);
    await consumeVerification(deps, check.verificationId);
    await deps.db.update(users).set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));
    // 重置密码 → 撤销该用户全部会话（ADR §9.3）
    await deps.db.delete(sessions).where(eq(sessions.userId, user.id));
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
    const auth = c.get("auth");
    if (!auth) return errorResponse(c, 401, "unauthorized", "需要登录");
    c.header("Cache-Control", "private, no-store");
    return c.json({ user: { id: auth.user.id, email: auth.user.email, username: auth.user.username, role: auth.user.role } });
  });

  return app;
}
