/**
 * BFF 转发核心（ADR-0001）：SSR apiFetch 与浏览器 Route Handler 共用同一个
 * Cookie→Bearer 转发模块；附 X-Client-IP、X-BFF-Token；强制 no-store。
 * web 层不做任何授权判断。
 */
import { SESSION_COOKIE } from "./constants";

export interface BffConfig {
  apiInternalUrl: string;
  bffSharedSecret: string;
  allowedOrigins: string[];
}

export function getBffConfig(): BffConfig {
  const apiInternalUrl = process.env.API_INTERNAL_URL;
  const bffSharedSecret = process.env.BFF_SHARED_SECRET;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!apiInternalUrl || !bffSharedSecret || allowedOrigins.length === 0) {
    throw new Error("BFF 配置缺失：API_INTERNAL_URL / BFF_SHARED_SECRET / ALLOWED_ORIGINS");
  }
  return { apiInternalUrl, bffSharedSecret, allowedOrigins };
}

/**
 * 从平台可信来源解析客户端 IP（ADR-0001 修订）：
 * - x-real-ip / x-vercel-forwarded-for 由 Vercel 平台设置；
 * - 绝不原样透传浏览器提供的 X-Forwarded-For 整链；本地开发退化为 127.0.0.1。
 */
export function resolvePlatformClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const vercelFwd = headers.get("x-vercel-forwarded-for");
  if (vercelFwd) return vercelFwd.split(",")[0]!.trim();
  // 本地开发：Next dev 会附加 x-forwarded-for；取最后一跳（服务端附加）
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim();
  return "127.0.0.1";
}

export function buildApiHeaders(opts: { sessionToken: string | null; clientIp: string; contentType?: string | null }): Headers {
  const config = getBffConfig();
  const headers = new Headers();
  headers.set("x-bff-token", config.bffSharedSecret);
  headers.set("x-client-ip", opts.clientIp);
  if (opts.sessionToken) headers.set("authorization", `Bearer ${opts.sessionToken}`);
  if (opts.contentType) headers.set("content-type", opts.contentType);
  return headers;
}

/**
 * CSRF 防线（ADR-0001 修订）：对所有 mutating 方法执行 Origin 白名单校验；
 * Origin 缺失时要求 Sec-Fetch-Site ∈ {same-origin, none}；其余一律拒绝。
 */
export function csrfCheck(req: Request): { ok: true } | { ok: false; reason: string } {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return { ok: true };
  const config = getBffConfig();
  const origin = req.headers.get("origin");
  if (origin) {
    if (config.allowedOrigins.includes(origin)) return { ok: true };
    return { ok: false, reason: `origin not allowed: ${origin}` };
  }
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === null || fetchSite === "same-origin" || fetchSite === "none") return { ok: true };
  return { ok: false, reason: `sec-fetch-site rejected: ${fetchSite}` };
}

/** 在响应上设置会话 Cookie（host-only、HttpOnly、Secure(prod)、SameSite=Lax）。 */
export function setSessionCookie(headers: Headers, token: string, expiresAt: Date) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  headers.append("set-cookie", parts.join("; "));
}

export function clearSessionCookie(headers: Headers) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  headers.append("set-cookie", parts.join("; "));
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return null;
}
