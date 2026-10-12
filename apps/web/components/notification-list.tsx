"use client";

/** 通知列表（Issue #14）：分页、标记已读、全部已读、评论锚点定位；全部私有 no-store。 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [reading, setReading] = useState(false);
  const readRequest = useRef(false);
  const pageRequest = useRef(false);
  const readAllStamp = useRef<string | null>(null);

  const load = useCallback(async (cursor: string | null) => {
    const res = await fetch(`/api/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", credentials: "same-origin" });
    if (res.status === 401) {
      router.replace("/login?returnTo=%2Fnotifications");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as NotificationListResponse;
    setItems((prev) => {
      const page = cursor && readAllStamp.current
        ? data.items.map((item) => ({ ...item, readAt: item.readAt ?? readAllStamp.current }))
        : data.items;
      return cursor ? [...prev, ...page] : page;
    });
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
    if (readRequest.current) return;
    readRequest.current = true;
    setReading(true);
    setActionError(false);
    try {
      if (!item.readAt) {
        const res = await fetch(`/api/notifications/${item.id}/read`, { method: "PATCH", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(String(res.status));
        setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x));
      }
      if (item.link) router.push(item.link);
    } catch {
      setActionError(true);
    } finally {
      readRequest.current = false;
      setReading(false);
    }
  }

  async function readAll() {
    if (readRequest.current) return;
    readRequest.current = true;
    setReading(true);
    setActionError(false);
    try {
      // 仅成功后更新已读；无快照回滚，不会删除等待期间追加的通知页。
      // 并发追加的是现有列表的更旧通知，亦在本次服务端 read-all 的范围内。
      const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(String(res.status));
      readAllStamp.current = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? readAllStamp.current })));
    } catch {
      setActionError(true);
    } finally {
      readRequest.current = false;
      setReading(false);
    }
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
      {actionError && (
        <p role="alert" className="mb-3 text-sm text-red-500">
          操作失败，请重试。
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" disabled={reading} onClick={() => void readAll()}>
          {reading ? "处理中…" : "全部标为已读"}
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void markRead(n)}
              disabled={reading}
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
          <Button
            variant="outline"
            size="sm"
            disabled={paging}
            onClick={() => {
              if (pageRequest.current) return;
              pageRequest.current = true;
              setPaging(true);
              void load(nextCursor).catch(() => setActionError(true)).finally(() => {
                pageRequest.current = false;
                setPaging(false);
              });
            }}
          >
            {paging ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}
