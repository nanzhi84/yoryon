"use client";

/** 通知列表（Issue #14）：分页、标记已读、全部已读、评论锚点定位；全部私有 no-store。 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import type { NotificationItem, NotificationListResponse } from "@/lib/types";
import { notifyNotificationsChanged } from "@/lib/notification-events";

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
  // 列表代次可由刷新重新创建，不能代替组件生命周期；卸载后任何响应都不得导航。
  const lifecycle = useRef<symbol | null>(null);
  const isActive = useCallback((scope: symbol | null) => scope !== null && lifecycle.current === scope, []);

  /** 重载后只接受新列表序列；每页的 readAt 始终来自服务端，不推断 UPDATE 的可见范围。 */
  const load = useCallback(async (cursor: string | null) => {
    const scope = lifecycle.current;
    if (!isActive(scope)) return;
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
      if (!isActive(scope) || current !== generation.current) return;
      if (res.status === 401) {
        router.replace("/login?returnTo=%2Fnotifications");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as NotificationListResponse;
      if (!isActive(scope) || current !== generation.current) return;
      pageCursor.current = { value: data.nextCursor, generation: current };
      setItems((prev) => isActive(scope) && current === generation.current ? (cursor ? [...prev, ...data.items] : data.items) : prev);
      setNextCursor(data.nextCursor);
    } catch (error) {
      if (!isActive(scope) || current !== generation.current) return;
      if (!cursor) setRefreshError(true);
      throw error;
    } finally {
      if (isActive(scope) && !cursor && current === generation.current) setRefreshing(false);
    }
  }, [router, isActive]);

  useEffect(() => {
    const scope = Symbol("notification-list");
    lifecycle.current = scope;
    readRequest.current = false;
    pageRequest.current = false;
    setReading(false);
    setPaging(false);
    (async () => {
      setLoading(true);
      setError(false);
      try {
        await load(null);
      } catch {
        if (isActive(scope)) setError(true);
      } finally {
        if (isActive(scope)) setLoading(false);
      }
    })();
    return () => {
      lifecycle.current = null;
      generation.current++;
      pageCursor.current = null;
    };
  }, [load, isActive]);

  async function markRead(item: NotificationItem) {
    const scope = lifecycle.current;
    if (!isActive(scope) || readRequest.current) return;
    readRequest.current = true;
    setReading(true);
    setActionError(false);
    try {
      if (!item.readAt) {
        const res = await fetch(`/api/notifications/${item.id}/read`, { method: "PATCH", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
        if (!isActive(scope)) return;
        if (!res.ok) throw new Error(String(res.status));
        setItems((prev) => isActive(scope) ? prev.map((x) => x.id === item.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x) : prev);
        notifyNotificationsChanged();
      }
      if (isActive(scope) && item.link) router.push(item.link);
    } catch {
      if (isActive(scope)) setActionError(true);
    } finally {
      if (isActive(scope)) {
        readRequest.current = false;
        setReading(false);
      }
    }
  }

  async function readAll() {
    const scope = lifecycle.current;
    if (!isActive(scope) || readRequest.current) return;
    readRequest.current = true;
    setReading(true);
    setActionError(false);
    let updated = false;
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      if (!isActive(scope)) return; // POST 可在服务端完成，但卸载后不再启动 GET 或导航。
      if (!res.ok) throw new Error(String(res.status));
      updated = true;
      notifyNotificationsChanged();
      // 成功后从首页重读权威状态，作废旧页；之后才提交的通知仍按服务端显示未读。
      // POST 失败不触碰列表/游标；GET 刷新失败单独提示并允许只重试读取。
      await load(null);
    } catch {
      if (isActive(scope) && !updated) setActionError(true);
    } finally {
      if (isActive(scope)) {
        readRequest.current = false;
        setReading(false);
      }
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
          <button className="underline" disabled={reading || refreshing} onClick={() => {
            const scope = lifecycle.current;
            void load(null).catch(() => { if (isActive(scope)) setRefreshError(true); });
          }}>重试刷新</button>
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
                  <span className="inline-flex items-center gap-2"><Avatar author={n.actor} /><span className="font-medium">{n.actor.displayName ?? n.actor.username}</span></span>{" "}
                  {n.type === "answer" ? "回答了你的问题" : n.type === "reply" ? "回复了你的评论" : "赞了你的评论"}
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
              const scope = lifecycle.current;
              if (!isActive(scope) || pageRequest.current) return;
              pageRequest.current = true;
              setPaging(true);
              void load(nextCursor).catch(() => { if (isActive(scope)) setActionError(true); }).finally(() => {
                if (isActive(scope)) {
                  pageRequest.current = false;
                  setPaging(false);
                }
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
