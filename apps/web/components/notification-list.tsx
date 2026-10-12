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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const readRequest = useRef(false);
  const pageRequest = useRef(false);
  const generation = useRef(0);
  const pageCursor = useRef<{ value: string | null; generation: number } | null>(null);

  /** 重载后只接受新列表序列；每页的 readAt 始终来自服务端，不推断 UPDATE 的可见范围。 */
  const load = useCallback(async (cursor: string | null) => {
    const owner = pageCursor.current;
    const current = cursor ? owner?.generation : ++generation.current;
    if (current === undefined || current !== generation.current || (cursor && owner?.value !== cursor)) return;
    if (!cursor) {
      pageCursor.current = null;
      setNextCursor(null);
      setRefreshing(true);
      setRefreshError(false);
    }
    try {
      const res = await fetch(`/api/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
        cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15_000),
      });
      if (current !== generation.current) return;
      if (res.status === 401) {
        router.replace("/login?returnTo=%2Fnotifications");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as NotificationListResponse;
      if (current !== generation.current) return;
      pageCursor.current = { value: data.nextCursor, generation: current };
      setItems((prev) => current === generation.current ? (cursor ? [...prev, ...data.items] : data.items) : prev);
      setNextCursor(data.nextCursor);
    } catch (error) {
      if (current !== generation.current) return;
      if (!cursor) setRefreshError(true);
      throw error;
    } finally {
      if (!cursor && current === generation.current) setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        await load(null);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      generation.current++;
      pageCursor.current = null;
    };
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
    let updated = false;
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(String(res.status));
      updated = true;
      // 成功后从首页重读权威状态，作废旧页；之后才提交的通知仍按服务端显示未读。
      // POST 失败不触碰列表/游标；GET 刷新失败单独提示并允许只重试读取。
      await load(null);
    } catch {
      if (!updated) setActionError(true);
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
      {refreshing && <p role="status" className="mb-3 text-sm text-muted-foreground">正在刷新通知…</p>}
      {refreshError && (
        <p role="alert" className="mb-3 text-sm text-red-500">
          通知列表刷新失败。
          <button className="underline" disabled={reading || refreshing} onClick={() => void load(null).catch(() => setRefreshError(true))}>重试刷新</button>
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" disabled={reading || refreshing} onClick={() => void readAll()}>
          {reading ? "处理中…" : "全部标为已读"}
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void markRead(n)}
              disabled={reading || refreshing}
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
            disabled={paging || refreshing}
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
