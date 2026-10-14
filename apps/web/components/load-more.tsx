"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { FeedTimeline } from "./feed-timeline";
import { Button } from "./ui/button";
import { BROWSE_LAYOUT_READY, currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";

// Appending a page must not parse previous Markdown or refetch every prior
// page's interaction counts. Keep each fetched batch and its provider stable.
const FeedBatch = memo(function FeedBatch({ items, showPinnedBadge }: { items: FeedItem[]; showPinnedBadge: boolean }) {
  return <FeedTimeline items={items} showPinnedBadge={showPinnedBadge} />;
});

/** 接近列表底部自动追加一页；失败暂停，用户可显式重试。 */
export function LoadMore({ initialCursor, version, basePath = "/api/feed", showPinnedBadge = false }: { initialCursor: string; version: string; basePath?: string; showPinnedBadge?: boolean }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pages, setPages] = useState<FeedItem[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    setReady(false); setError(false); setExpired(false); setLoading(false);
    const key = `feed:${currentBrowsePath()}:${basePath}`;
    const saved = readBrowse<{ version: string; initialCursor: string; cursor: string | null; items: FeedItem[] }>(key);
    if (saved?.version === version && saved.initialCursor === initialCursor && Array.isArray(saved.items)
      && saved.items.every(item => typeof item?.id === "string" && typeof item.slug === "string" && ["post", "article"].includes(item.type))) {
      const restored: FeedItem[][] = [];
      for (let offset = 0; offset < saved.items.length; offset += 20) restored.push(saved.items.slice(offset, offset + 20));
      setPages(restored); setCursor(saved.cursor);
    } else { writeBrowse(key, null); setPages([]); setCursor(initialCursor); }
    setReady(true);
    return () => { active.current?.abort(); active.current = null; };
  }, [version, initialCursor, basePath]);

  useLayoutEffect(() => {
    if (ready) window.dispatchEvent(new Event(BROWSE_LAYOUT_READY));
  }, [ready, pages]);

  const load = useCallback(async () => {
    if (!cursor || !ready || expired || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/pages/${version}/${basePath === "/api/feed" ? "feed" : basePath === "/api/paid-feed" ? "paid-feed" : `tag-${basePath.slice("/api/tags/".length)}`}/${encodeURIComponent(cursor)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (controller.signal.aborted) return;
      if (res.status === 409) { setExpired(true); writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, null); return; }
      // 游标失效（如部署后旧格式残留）：与快照过期同一恢复路径——提示刷新，而不是带着旧游标重试
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        if (controller.signal.aborted) return;
        if (body?.error?.code === "invalid_cursor") { setExpired(true); writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, null); return; }
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as FeedResponse;
      if (controller.signal.aborted) return;
      if (data.version !== version) { setExpired(true); writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, null); return; }
      if (!Array.isArray(data.items) || !data.items.every(item => typeof item?.id === "string" && typeof item.slug === "string" && ["post", "article"].includes(item.type))
        || (data.nextCursor !== null && typeof data.nextCursor !== "string") || data.nextCursor === cursor) throw new Error("invalid page");
      const items = pages.flat();
      const seen = new Set(items.map(item => item.id));
      const nextPage = data.items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
      if (!nextPage.length && data.nextCursor !== null) throw new Error("page made no progress");
      const appended = [...items, ...nextPage];
      if (nextPage.length) setPages([...pages, nextPage]);
      setCursor(data.nextCursor);
      writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, { version, initialCursor, cursor: data.nextCursor, items: appended });
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  }, [basePath, cursor, expired, initialCursor, pages, ready, version]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !ready || !cursor || expired || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load();
    }, { rootMargin: "0px 0px 600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready, cursor, expired, error, load]);

  return (
    <div className="py-6" data-browse-ready={ready}>
      <div className="divide-y divide-border">{pages.map(page => <FeedBatch key={page[0]!.id} items={page} showPinnedBadge={showPinnedBadge} />)}</div>
      {error && <p role="alert" className="py-2 text-center text-sm text-red-500">加载失败，请重试。</p>}
      {expired && <p role="status">列表已更新。<button className="underline" onClick={() => window.location.reload()}>刷新列表</button></p>}
      {cursor && !expired && (
        <div ref={sentinel} className="flex min-h-11 justify-center" aria-busy={loading}>
          {error ? <Button variant="outline" onClick={() => void load()} disabled={loading}>重试</Button>
            : <p role="status" className="py-3 text-sm text-muted-foreground">{loading ? "加载中…" : "继续向下浏览"}</p>}
        </div>
      )}
    </div>
  );
}
