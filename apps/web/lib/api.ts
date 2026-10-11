/**
 * SSR apiFetch（ADR-0001）：与浏览器 Route Handler 共用同一个 Cookie→Bearer 转发模块；
 * 默认 cache: 'no-store'；仅私有线（内容详情等权益相关页面）使用。
 *
 * 公开线（feed/tags/sitemap）必须改用 publicFetch：它不读取 cookies()/headers()，
 * 页面才能进入 Full Route Cache / ISR；本函数一旦出现在公开页面，动态 API 会把整页逐出静态缓存。
 */
import { cookies, headers } from "next/headers";
import { buildApiHeaders, getBffConfig, readSessionCookie, resolvePlatformClientIp } from "./bff";

export interface ApiFetchOptions {
  /** @deprecated 公开缓存请用 publicFetch；apiFetch 为私有线，恒 no-store */
  revalidate?: number;
}

/**
 * 公开线专用请求：不带 Cookie/会话/IP 转发，响应与身份无关（API 端点实现也不读 session）。
 * 强制显式 revalidate，避免误用为 no-store（那就该走 apiFetch）。
 */
export async function publicFetch(path: string, options: { revalidate: number }): Promise<Response> {
  const config = getBffConfig();
  return fetch(`${config.apiInternalUrl}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate: options.revalidate },
  });
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const config = getBffConfig();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionToken = cookieStore.get("yoryon_session")?.value ?? readSessionCookie(headerStore.get("cookie"));
  const clientIp = resolvePlatformClientIp(headerStore);
  const fetchHeaders = buildApiHeaders({ sessionToken, clientIp, contentType: null });
  fetchHeaders.set("accept", "application/json");
  // 私有线一律 no-store（ADR-0003）；公开缓存请改用 publicFetch
  return fetch(`${config.apiInternalUrl}${path}`, {
    headers: fetchHeaders,
    cache: "no-store",
  });
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export async function apiJson<T>(path: string, options?: ApiFetchOptions): Promise<T | null> {
  const res = await apiFetch(path, options);
  if (!res.ok) return null;
  return (await res.json()) as T;
}
