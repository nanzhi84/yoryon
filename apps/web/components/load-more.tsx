"use client";

import { useState } from "react";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { FeedTimeline } from "./feed-timeline";
import { Button } from "./ui/button";

/** 信息流"加载更多"（游标分页，经同源 BFF）。 */
export function LoadMore({ initialCursor }: { initialCursor: string }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
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
      <FeedTimeline items={items} />
      {error && <p className="py-2 text-center text-sm text-red-500">加载失败，请重试。</p>}
      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}
