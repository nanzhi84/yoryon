/**
 * /api/* BFF 代理（ADR-0001）。
 * - 路径白名单 + 请求头过滤；
 * - mutating 方法经 CSRF 检查；
 * - Cookie → Bearer 转换；login/verify-email 的 token 转 Set-Cookie；logout 清 Cookie；
 * - 会话续期（x-session-expires）时重设 Cookie；
 * - 透传 302 Location（媒体字节不经过 Vercel）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { buildApiHeaders, csrfCheck, getBffConfig, readSessionCookie, resolvePlatformClientIp, clearSessionCookie, setSessionCookie } from "@/lib/bff";

const ALLOWED_PATH = /^\/api\/(auth\/[a-z-]+|feed|contents\/[^/]+|collections(?:\/[^/]+)?|tags\/[^/]+|media\/[0-9a-fA-F-]{36}|redemptions|me\/entitlements)$/;

async function proxy(req: NextRequest): Promise<Response> {
  const config = getBffConfig();
  const url = new URL(req.url);
  const path = url.pathname;

  if (!ALLOWED_PATH.test(path)) {
    return NextResponse.json({ error: { code: "not_found", message: "接口不存在" } }, { status: 404 });
  }

  const csrf = csrfCheck(req);
  if (!csrf.ok) {
    console.warn(JSON.stringify({ level: "warn", msg: "csrf rejected", reason: csrf.reason, path }));
    return NextResponse.json({ error: { code: "csrf_rejected", message: "请求来源非法" } }, { status: 403 });
  }

  const sessionToken = readSessionCookie(req.headers.get("cookie"));
  const clientIp = resolvePlatformClientIp(req.headers);
  const headers = buildApiHeaders({ sessionToken, clientIp, contentType: req.headers.get("content-type") });
  headers.set("accept", req.headers.get("accept") ?? "application/json");
  const range = req.headers.get("range");
  if (range) headers.set("range", range);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const apiRes = await fetch(`${config.apiInternalUrl}${path}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : null,
    redirect: "manual",
    cache: "no-store",
  });

  // 复制响应（过滤 hop-by-hop 头；content-length/content-encoding 由 Next 依据实际响应体重算——
  // 登录分支会剥离 token 改写 body，透传原 content-length 会导致浏览器 CONTENT_LENGTH_MISMATCH）
  const resHeaders = new Headers();
  for (const [k, v] of apiRes.headers) {
    if (["transfer-encoding", "connection", "keep-alive", "content-length", "content-encoding"].includes(k.toLowerCase())) continue;
    resHeaders.set(k, v);
  }

  // 登录/邮箱验证成功：token → HttpOnly Cookie，响应体不含 token
  if ((path === "/api/auth/login" || path === "/api/auth/verify-email") && apiRes.status === 200) {
    const body = (await apiRes.json()) as { token?: string; expiresAt?: string; user?: unknown };
    if (body.token && body.expiresAt) {
      setSessionCookie(resHeaders, body.token, new Date(body.expiresAt));
    }
    const { token: _t, ...rest } = body;
    return new NextResponse(JSON.stringify(rest), { status: 200, headers: resHeaders });
  }

  // 登出：无论 API 结果如何都清 Cookie
  if (path === "/api/auth/logout") {
    clearSessionCookie(resHeaders);
  }

  // 会话滑动续期：重设 Cookie
  const renewed = apiRes.headers.get("x-session-expires");
  if (renewed && sessionToken) {
    setSessionCookie(resHeaders, sessionToken, new Date(renewed));
    resHeaders.delete("x-session-expires");
  }

  // 302 透传（媒体签名 URL）
  if (apiRes.status >= 300 && apiRes.status < 400) {
    return new NextResponse(null, { status: apiRes.status, headers: resHeaders });
  }

  return new NextResponse(apiRes.body, { status: apiRes.status, headers: resHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

export const dynamic = "force-dynamic";
