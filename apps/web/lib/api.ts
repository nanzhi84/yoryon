/**
 * SSR apiFetch（ADR-0001）：与浏览器 Route Handler 共用同一个 Cookie→Bearer 转发模块；
 * 默认 cache: 'no-store'；仅私有线（内容详情等权益相关页面）使用。
 *
 * 公开线不转发 cookies()/headers()；正文数据用 publicFetch 缓存。
 * feed/tags 首屏通过 no-store 目录范围版本动态渲染，列表数据仍共享带版本的 Data Cache。
 */
import { cookies, headers } from "next/headers";
import { buildApiHeaders, getBffConfig, readSessionCookie, resolvePlatformClientIp } from "./bff";

export interface ApiFetchOptions {
  /** @deprecated 公开缓存请用 publicFetch；apiFetch 为私有线，恒 no-store */
  revalidate?: number;
}

/** 公开线服务端地址（不转发 Cookie/IP；仅组装 URL）。 */
function publicUrl(path: string): string {
  return `${getBffConfig().apiInternalUrl}${path}`;
}

/**
 * 公开线旁路：不使用 Data Cache（no-store）。用于 sitemap 和实时目录版本门禁；
 * 列表正文仍通过 publicFetch 使用带版本的共享缓存。
 */
export async function publicFetchNoStore(path: string, options: { signal?: AbortSignal } = {}): Promise<Response> {
  return fetch(publicUrl(path), { headers: { accept: "application/json" }, cache: "no-store", signal: options.signal ?? null });
}

/**
 * 公开线专用请求：不带 Cookie/会话/IP 转发，响应与身份无关（API 端点实现也不读 session）。
 * 强制显式 revalidate，避免误用为 no-store（那就该走 apiFetch）。
 */
export async function publicFetch(path: string, options: { revalidate: number; tags?: string[] }): Promise<Response> {
  return fetch(publicUrl(path), {
    headers: { accept: "application/json" },
    next: { revalidate: options.revalidate, ...(options.tags ? { tags: options.tags } : {}) },
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
