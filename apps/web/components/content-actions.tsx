"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TrackClickLink } from "./analytics";
import { Check, Heart, MessageCircle, Repeat2 } from "lucide-react";

interface Interaction {
  id: string;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  canLike: boolean;
}
class ActionError extends Error {}
function isInteraction(value: unknown): value is Interaction {
  const row = value as Interaction | null;
  return !!row && typeof row.id === "string" && Number.isSafeInteger(row.commentCount) && row.commentCount >= 0
    && Number.isSafeInteger(row.likeCount) && row.likeCount >= 0 && typeof row.liked === "boolean" && typeof row.canLike === "boolean";
}

interface InteractionContext {
  items: Record<string, Interaction>;
  authenticated: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  startWrite: (id: string) => boolean;
  finishWrite: (id: string, value?: { liked: boolean; likeCount: number }) => void;
}
const Context = createContext<InteractionContext | null>(null);

/** 每批列表统一读取身份数据，避免每条发请求或污染公共内容缓存。 */
export function ContentInteractions({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  const key = [...new Set(ids)].join(",");
  const [items, setItems] = useState<Record<string, Interaction>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const read = useRef<AbortController | null>(null);
  const writes = useRef(new Set<string>());
  const generation = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (!key || writes.current.size) return;
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    const version = ++generation.current;
    setError(false);
    try {
      const all: Interaction[] = [];
      const list = key.split(",");
      let signedIn = false;
      // LoadMore 可以累积多页；每次最多100个 ID，保持单个请求与并发有界。
      for (let offset = 0; offset < list.length; offset += 100) {
        const response = await fetch(`/api/content-interactions?ids=${list.slice(offset, offset + 100).join(",")}`, {
          credentials: "same-origin", cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) throw new Error("interactions unavailable");
        const data = await response.json() as { items?: unknown[]; authenticated?: unknown };
        if (!Array.isArray(data.items) || !data.items.every(isInteraction) || typeof data.authenticated !== "boolean") throw new Error("invalid interactions");
        all.push(...data.items); signedIn = data.authenticated;
      }
      if (version === generation.current && !controller.signal.aborted) {
        setItems(Object.fromEntries(all.map(row => [row.id, row]))); setAuthenticated(signedIn);
      }
    } catch { if (version === generation.current && !controller.signal.aborted) setError(true); }
  }, [key]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { mounted.current = false; ++generation.current; read.current?.abort(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);
  function startWrite(id: string) {
    if (writes.current.has(id)) return false;
    writes.current.add(id); ++generation.current; read.current?.abort(); return true;
  }
  function finishWrite(id: string, value?: { liked: boolean; likeCount: number }) {
    if (value && mounted.current) setItems(prev => prev[id] ? { ...prev, [id]: { ...prev[id]!, ...value } } : prev);
    writes.current.delete(id);
    if (!writes.current.size && mounted.current) void latestRefresh.current();
  }
  return <Context.Provider value={{ items, authenticated, error, refresh, startWrite, finishWrite }}>{children}</Context.Provider>;
}

export function ContentActions({ id, slug, trackClicks = true }: { id: string; slug: string; trackClicks?: boolean }) {
  const context = useContext(Context);
  if (!context) throw new Error("ContentActions requires ContentInteractions");
  const row = context.items[id];
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { request.current?.abort(); if (timer.current) clearTimeout(timer.current); }, []);
  const href = `/p/${encodeURIComponent(slug)}`;
  async function like() {
    if (!row || pending) return;
    if (!context!.authenticated) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`); return;
    }
    if (!row.canLike) { setMessage("订阅或兑换此作品后可点赞。"); return; }
    if (!context!.startWrite(id)) return;
    const controller = new AbortController(); request.current = controller;
    let result: { liked: boolean; likeCount: number } | undefined;
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/content-interactions/${id}/like`, { method: row.liked ? "DELETE" : "PUT",
        credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (response.status === 401) {
        window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return;
      }
      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string } };
        throw new ActionError(data.error?.message ?? "点赞失败，请重试。");
      }
      const data = await response.json() as { liked: boolean; likeCount: number };
      if (typeof data.liked !== "boolean" || !Number.isSafeInteger(data.likeCount) || data.likeCount < 0) throw new ActionError("点赞状态加载失败，请重试。");
      if (!controller.signal.aborted) result = data;
    } catch (err) {
      if (!controller.signal.aborted) setMessage(err instanceof ActionError ? err.message
        : err instanceof Error && err.name === "TimeoutError" ? "网络请求超时，请重试。" : "网络请求失败，请重试。");
    } finally { context!.finishWrite(id, result); if (!controller.signal.aborted) setPending(false); }
  }
  async function copyLink() {
    if (copying) return;
    const link = new URL(href, window.location.origin).href;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setManualLink(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch { setManualLink(link); setCopied(false); }
    finally { setCopying(false); }
  }
  const actionClass = "inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[13px] leading-5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40";
  return <div className="mt-1">
    <div className="flex items-center justify-between text-muted-foreground" aria-label="内容互动">
      <TrackClickLink native enabled={trackClicks} targetKind="work" targetId={id} href={`${href}#comments`} className={actionClass} aria-label={`评论${row ? `，${row.commentCount}条` : ""}`}>
        <MessageCircle className="size-[17px]" strokeWidth={1.7} aria-hidden="true" /><span>{row?.commentCount || "评论"}</span>
      </TrackClickLink>
      <button type="button" className={`${actionClass} ${row?.liked ? "text-primary" : ""}`} onClick={() => void like()} disabled={!row || pending}
        aria-label={`${row?.liked ? "取消点赞" : "点赞"}${row ? `，${row.likeCount}个赞` : ""}`} aria-pressed={row?.liked ?? false} aria-busy={pending}>
        <Heart className={`size-[17px] ${row?.liked ? "fill-current" : ""}`} strokeWidth={1.7} aria-hidden="true" /><span>{pending ? "…" : row?.likeCount || "点赞"}</span>
      </button>
      <button type="button" className={`${actionClass} ${copied ? "text-primary" : ""}`} onClick={() => void copyLink()} disabled={copying} aria-label="转发，复制链接">
        {copied ? <Check className="size-[17px]" aria-hidden="true" /> : <Repeat2 className="size-[17px]" strokeWidth={1.7} aria-hidden="true" />}<span>{copied ? "已复制" : "转发"}</span>
      </button>
    </div>
    <span role="status" className="sr-only">{copied ? "链接已复制" : ""}</span>
    {context.error && <p role="alert" className="text-xs text-muted-foreground">互动信息加载失败。<button type="button" className="underline" onClick={() => void context.refresh()}>重试</button></p>}
    {message && <p role="alert" className="text-xs text-muted-foreground">{message}</p>}
    {manualLink && <label className="mt-2 block text-xs text-muted-foreground">复制失败，可选择下方链接手动复制或再次点击转发。
      <input aria-label="手动复制作品链接" readOnly value={manualLink} onFocus={event => event.target.select()} className="mt-1 block w-full bg-transparent py-2 text-sm text-foreground underline focus-visible:outline-primary" />
    </label>}
  </div>;
}
