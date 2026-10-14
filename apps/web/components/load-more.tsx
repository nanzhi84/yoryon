"use client";

import { useEffect, useState } from "react";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { FeedTimeline } from "./feed-timeline";
import { Button } from "./ui/button";
import { currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";

/** 信息流/标签页"加载更多"（游标分页，经同源 BFF）。 */
export function LoadMore({ initialCursor, version, basePath = "/api/feed", showPinnedBadge = false }: { initialCursor: string; version: string; basePath?: string; showPinnedBadge?: boolean }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const key = `feed:${currentBrowsePath()}:${basePath}`;
    const saved = readBrowse<{ version: string; initialCursor: string; cursor: string | null; items: FeedItem[] }>(key);
    if (saved?.version === version && saved.initialCursor === initialCursor && Array.isArray(saved.items)
      && saved.items.every(item => typeof item?.id === "string" && typeof item.slug === "string" && ["post", "article"].includes(item.type))) {
      setItems(saved.items); setCursor(saved.cursor);
    } else { writeBrowse(key, null); }
  }, [version, initialCursor, basePath]);

  async function load() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/pages/${version}/${basePath === "/api/feed" ? "feed" : basePath === "/api/paid-feed" ? "paid-feed" : `tag-${basePath.slice("/api/tags/".length)}`}/${encodeURIComponent(cursor)}`);
      if (res.status === 409) { setExpired(true); writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, null); return; }
      // 游标失效（如部署后旧格式残留）：与快照过期同一恢复路径——提示刷新，而不是带着旧游标重试
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        if (body?.error?.code === "invalid_cursor") { setExpired(true); return; }
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as FeedResponse;
      const appended = [...items, ...data.items];
      setItems(appended);
      setCursor(data.nextCursor);
      writeBrowse(`feed:${currentBrowsePath()}:${basePath}`, { version, initialCursor, cursor: data.nextCursor, items: appended });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-6">
      <FeedTimeline items={items} showPinnedBadge={showPinnedBadge} />
      {error && <p className="py-2 text-center text-sm text-red-500">加载失败，请重试。</p>}
      {expired && <p role="status">列表已更新。<button className="underline" onClick={() => window.location.reload()}>刷新列表</button></p>}
      {cursor && !expired && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}
