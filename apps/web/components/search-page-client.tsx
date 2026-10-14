"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Button } from "./ui/button";
import { BROWSE_RETURNED } from "./navigation-memory";
import { readBrowse, writeBrowse } from "@/lib/browse-memory";
import { NOTIFICATIONS_CHANGED } from "@/lib/notification-events";
import type { SearchHit } from "@yoryon/config/search-text";

interface Item { id: string; slug: string; title: string; description: string; publishedAt: string | null; visibility: "public" | "paid"; canAccess: boolean; revision?: string; hits?: SearchHit[] }
interface Result { session: string; query: string; results: Item[]; nextCursor: number | null; bodySearch: boolean; quota: { remaining: number | null; releasesAt: string | null } }
interface Memory { query: string; request: { query: string; requestId: string } | null; session: string | null; offsets: number[] }
function validMemory(value: Memory | null): value is Memory {
  return !!value && typeof value.query === "string" && value.query.length <= 120 && (value.session === null || typeof value.session === "string")
    && (value.request === null || (typeof value.request?.query === "string" && typeof value.request?.requestId === "string"))
    && Array.isArray(value.offsets) && value.offsets.length <= 50 && value.offsets.every(offset => Number.isInteger(offset) && offset >= 0 && offset <= 980 && offset % 20 === 0);
}
class SearchError extends Error { constructor(message: string, readonly code: string, readonly releasesAt: string | null = null) { super(message); } }
function Highlight({ text, query }: { text: string; query: string }) { return <>{text.split(query).map((part, index) => <span key={index}>{index > 0 && <mark className="rounded bg-yellow-200 text-black">{query}</mark>}{part}</span>)}</>; }

/** 仅记查询与服务器会话/分页；离开前清空正文命中，返回经no-store重新授权，不重扣搜索额度。 */
export function SearchPageClient() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exhausted, setExhausted] = useState(false);
  const [releases, setReleases] = useState<string | null>(null);
  const [retainedHeight, setRetainedHeight] = useState(0);
  const resultsHost = useRef<HTMLDivElement>(null);
  const memory = useRef<Memory>({ query: "", request: null, session: null, offsets: [] });
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  function save(value: Memory) { memory.current = value; writeBrowse("search", value); }
  async function request(body: unknown, controller: AbortController): Promise<Result> {
    const response = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", credentials: "same-origin",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
    const data = await response.json();
    if (!response.ok) throw new SearchError(data.error?.message ?? "搜索失败，请重试。", data.error?.code ?? "search_failed", data.quota?.releasesAt ?? null);
    if (typeof data.session !== "string" || typeof data.query !== "string" || !Array.isArray(data.results)
      || !data.results.every((item: Item) => item && typeof item.id === "string" && typeof item.slug === "string" && typeof item.title === "string" && typeof item.description === "string" && typeof item.canAccess === "boolean"
        && (item.hits === undefined || (Array.isArray(item.hits) && item.hits.every(hit => typeof hit.context === "string" && Number.isInteger(hit.start)))))
      || !data.quota || (data.quota.remaining !== null && !Number.isInteger(data.quota.remaining))
      || (data.nextCursor !== null && !Number.isInteger(data.nextCursor))) throw new SearchError("搜索结果暂不可用，请重试。", "invalid_response");
    return data as Result;
  }
  function fail(reason: unknown) {
    setRetainedHeight(0);
    const controlled = reason instanceof SearchError;
    setError(controlled ? reason.message : "网络请求失败，请重试。");
    setExhausted(controlled && reason.code === "search_quota_exhausted");
    setReleases(controlled ? reason.releasesAt : null);
    if (controlled && reason.code === "search_expired") { save({ ...memory.current, request: null, session: null, offsets: [] }); setResult(null); }
  }
  async function restore() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    const version = ++generation.current;
    const stored = readBrowse<Memory>("search");
    if (validMemory(stored)) { memory.current = stored; setQuery(stored.query); }
    const saved = memory.current;
    if (!saved.session || !saved.offsets.length) { setResult(null); setRetainedHeight(0); setBusy(false); pending.current = false; return; }
    pending.current = true; setBusy(true); setResult(null); setError("");
    try {
      let merged: Result | null = null;
      for (const offset of saved.offsets) {
        const data = await request({ session: saved.session, cursor: offset }, controller);
        merged = merged ? { ...data, results: [...merged.results, ...data.results] } : data;
      }
      if (version === generation.current && !controller.signal.aborted) { setResult(merged); setRetainedHeight(0); }
    } catch (reason) { if (version === generation.current && !controller.signal.aborted) fail(reason); }
    finally { if (version === generation.current) { pending.current = false; setBusy(false); } }
  }
  useEffect(() => {
    void restore();
    const identity = () => { active.current?.abort(); ++generation.current; pending.current = false; setBusy(false); setResult(null); setQuery(""); save({ query: "", request: null, session: null, offsets: [] }); };
    const focus = () => { if (document.visibilityState === "visible" && !pending.current) void restore(); };
    window.addEventListener(BROWSE_RETURNED, restore); window.addEventListener("focus", focus); window.addEventListener(NOTIFICATIONS_CHANGED, identity);
    window.addEventListener("pagehide", discardResults);
    return () => { ++generation.current; active.current?.abort(); window.removeEventListener(BROWSE_RETURNED, restore); window.removeEventListener("focus", focus); window.removeEventListener(NOTIFICATIONS_CHANGED, identity); window.removeEventListener("pagehide", discardResults); };
  }, []);
  async function submit(more = false) {
    if (pending.current || !query.trim() || (more && result?.nextCursor == null)) return;
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    const version = ++generation.current; pending.current = true; setBusy(true); setError(""); setExhausted(false);
    const offset = more ? result!.nextCursor! : 0;
    if (!more && memory.current.request?.query !== query) save({ query, request: { query, requestId: crypto.randomUUID() }, session: null, offsets: [] });
    try {
      const data = await request(more ? { session: result!.session, cursor: offset } : memory.current.request, controller);
      if (version !== generation.current || controller.signal.aborted) return;
      setResult(more && result ? { ...data, results: [...result.results, ...data.results] } : data);
      setRetainedHeight(0);
      save({ query, request: memory.current.request, session: data.session, offsets: more ? [...memory.current.offsets, offset] : [0] });
    } catch (reason) { if (version === generation.current && !controller.signal.aborted) fail(reason); }
    finally { if (version === generation.current) { pending.current = false; setBusy(false); } }
  }
  function change(value: string) { active.current?.abort(); ++generation.current; pending.current = false; setBusy(false); setQuery(value); setResult(null); setError(""); setRetainedHeight(0); save({ query: value, request: null, session: null, offsets: [] }); }
  function discardResults() {
    // pagehide也覆盖顶栏、地址栏等离开方式；冻结前移除命中并取消未完成请求。
    active.current?.abort(); ++generation.current; pending.current = false;
    const height = resultsHost.current?.getBoundingClientRect().height ?? 0;
    flushSync(() => { setRetainedHeight(height); setResult(null); setBusy(false); });
  }
  function leave(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    discardResults();
  }
  return <>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">输入想找的原文。区分大小写、空格与标点；至少三个连续文字或数字时，也会搜索正文。</p>
    <form className="mt-5 flex gap-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <input aria-label="搜索原文" maxLength={120} value={query} onChange={event => change(event.target.value)} placeholder="输入关键词或连续原文" className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm focus-visible:outline-primary" />
      <Button disabled={busy || !query.trim()} type="submit">{busy ? "搜索中…" : "搜索"}</Button>
    </form>
    <div ref={resultsHost} className="mt-6" style={{ minHeight: retainedHeight || undefined }} aria-busy={busy} aria-live="polite">
      {busy && !result && <p role="status" className="py-6 text-sm text-muted-foreground">正在加载搜索结果…</p>}
      {error && <p role="alert" className="py-3 text-sm">{error}{!exhausted && <button type="button" className="ml-2 underline" disabled={busy} onClick={() => void (memory.current.session ? restore() : submit())}>重试</button>}</p>}
      {exhausted && <div className="pb-4 text-sm"><p className="text-muted-foreground">{releases && `恢复时间：${new Date(releases).toLocaleTimeString("zh-CN", { timeZone: "Asia/Singapore" })}`}</p><Link prefetch={false} href="/redeem" className="mt-2 inline-block text-primary underline">开通订阅，解锁无限搜索</Link></div>}
      {result && <>
        <p className="mb-2 text-xs text-muted-foreground">{result.quota.remaining === null ? "订阅用户：无限搜索" : `本小时剩余 ${result.quota.remaining} 次搜索`}{!result.bodySearch && " · 本次只搜索标题与描述"}</p>
        {!result.results.length && <p className="py-6 text-center text-sm text-muted-foreground">没有找到匹配内容</p>}
        {result.results.map(item => <article key={item.id} className="py-5">
          <a href={`/p/${item.slug}`} onClick={leave} className="font-semibold hover:underline"><Highlight text={item.title || "帖子"} query={result.query} /></a>
          <p className="mt-1 text-xs text-muted-foreground">{item.visibility === "paid" ? "付费" : "免费"} · {item.publishedAt?.slice(0, 10)}</p>
          {item.description && <p className="mt-2 text-sm"><Highlight text={item.description} query={result.query} /></p>}
          {item.hits?.map(hit => <a key={hit.start} onClick={leave} href={`/p/${item.slug}#search=${result.session}&revision=${item.revision}&start=${hit.start}`} className="mt-2 block whitespace-pre-wrap text-sm leading-relaxed hover:text-primary"><Highlight text={hit.context} query={result.query} /><span className="ml-2 text-xs text-primary">定位原文 →</span></a>)}
          {item.visibility === "paid" && !item.canAccess && <Link prefetch={false} href="/redeem" className="mt-2 inline-block text-xs text-primary">开通订阅，查看正文命中位置</Link>}
        </article>)}
        {result.nextCursor !== null && <Button variant="outline" className="my-4 w-full" disabled={busy} onClick={() => void submit(true)}>加载更多</Button>}
      </>}
      {!result && !busy && !error && <p className="py-6 text-center text-sm text-muted-foreground">搜索文章、帖子和正文中的内容。</p>}
    </div>
  </>;
}
