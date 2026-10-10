/**
 * SSR apiFetch（ADR-0001）：与浏览器 Route Handler 共用同一个 Cookie→Bearer 转发模块；
 * 默认 cache: 'no-store'；需要公开缓存的调用必须显式传 revalidate（ADR-0003）。
 */
import { cookies, headers } from "next/headers";
import { buildApiHeaders, getBffConfig, readSessionCookie, resolvePlatformClientIp } from "./bff";

export interface ApiFetchOptions {
  /** 公开缓存线（feed/tags）显式声明 revalidate 秒数；其余一律 no-store */
  revalidate?: number;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const config = getBffConfig();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionToken = cookieStore.get("yoryon_session")?.value ?? readSessionCookie(headerStore.get("cookie"));
  const clientIp = resolvePlatformClientIp(headerStore);
  const fetchHeaders = buildApiHeaders({ sessionToken, clientIp, contentType: null });
  fetchHeaders.set("accept", "application/json");
  return fetch(`${config.apiInternalUrl}${path}`, {
    headers: fetchHeaders,
    ...(options.revalidate !== undefined ? { next: { revalidate: options.revalidate } } : { cache: "no-store" }),
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
