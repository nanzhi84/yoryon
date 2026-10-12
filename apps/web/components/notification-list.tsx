"use client";

/** 通知列表（Issue #14）：分页、标记已读、全部已读、评论锚点定位；全部私有 no-store。 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { NotificationItem, NotificationListResponse } from "@/lib/types";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Singapore", hour12: false });
}

export function NotificationList() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (cursor: string | null) => {
    const res = await fetch(`/api/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", credentials: "same-origin" });
    if (res.status === 401) {
      router.replace("/login?returnTo=%2Fnotifications");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as NotificationListResponse;
    setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }, [router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(false);
      try {
        await load(null);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function markRead(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void fetch(`/api/notifications/${item.id}/read`, { method: "PATCH", credentials: "same-origin" });
    }
    if (item.link) router.push(item.link);
  }

  async function readAll() {
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin" });
  }

  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>;
  if (error)
    return (
      <p role="alert" className="py-12 text-center text-sm text-red-500">
        加载失败。
        <button className="underline" onClick={() => window.location.reload()}>
          重试
        </button>
      </p>
    );
  if (items.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">暂无通知。</p>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void readAll()}>
          全部标为已读
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void markRead(n)}
              className={`block w-full py-3 text-left ${n.link ? "" : "cursor-default"}`}
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className={`text-sm ${n.readAt ? "text-muted-foreground" : "font-medium"}`}>
                  {!n.readAt && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle" aria-label="未读" />}
                  <span className="font-medium">{n.actor.username}</span>{" "}
                  {n.type === "reply" ? "回复了你的评论" : "赞了你的评论"}
                  {n.contentTitle ? `：《${n.contentTitle}》` : "（内容已下线）"}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">{fmtTime(n.createdAt)}</time>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void load(nextCursor)}>
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}
