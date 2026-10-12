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
 * 有上限的流式请求体读取：Content-Length 预检 + 逐 chunk 字节累计，超限立即中止并取消流。
 * （analytics ingest 匿名入口的大载荷防线；字符串 length 是 UTF-16 码元数，不能当字节数用）
 *
 * 与 packages/core/src/http.ts 的 readBodyCapped 有意重复：@yoryon/core 为 source-only 且
 * 依赖 argon2/ali-oss/pg 等 Node 重依赖，web 侧不引入该包；两侧实现独立演进，修改时请同步。
 */
export async function readBodyBytesCapped(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      exceeded = true;
      break;
    }
    chunks.push(value);
  }
  if (exceeded) {
    await reader.cancel().catch(() => {});
    return null;
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buf;
}

export async function readBodyCapped(req: Request, maxBytes: number): Promise<string | null> {
  const bytes = await readBodyBytesCapped(req, maxBytes);
  return bytes === null ? null : new TextDecoder().decode(bytes);
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
 * Origin 缺失时要求 Sec-Fetch-Site = same-origin（非浏览器客户端使用 API Bearer，不使用 Cookie BFF）；其余一律拒绝。
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
  if (fetchSite === "same-origin") return { ok: true };
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
