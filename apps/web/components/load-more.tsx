"use client";

import { useState } from "react";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { FeedTimeline } from "./feed-timeline";
import { Button } from "./ui/button";

/** 信息流/标签页"加载更多"（游标分页，经同源 BFF）。 */
export function LoadMore({ initialCursor, version, basePath = "/api/feed", showPinnedBadge = false }: { initialCursor: string; version: string; basePath?: string; showPinnedBadge?: boolean }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);

  async function load() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/pages/${version}/${basePath === "/api/feed" ? "feed" : basePath === "/api/paid-feed" ? "paid-feed" : `tag-${basePath.slice("/api/tags/".length)}`}/${encodeURIComponent(cursor)}`);
      if (res.status === 409) { setExpired(true); return; }
      // 游标失效（如部署后旧格式残留）：与快照过期同一恢复路径——提示刷新，而不是带着旧游标重试
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        if (body?.error?.code === "invalid_cursor") { setExpired(true); return; }
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as FeedResponse;
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
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
