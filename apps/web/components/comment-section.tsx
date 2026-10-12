"use client";

/**
 * 评论区（Issue #14）：客户端渲染，不进入公开缓存页面。
 * - 列表数据来自公开接口（游客可读）；互动上下文与点赞状态来自私有 no-store 接口。
 * - 未登录点击互动 → 引导登录并保留返回路径；付费文章无权益 → 锁定提示。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommentContext, CommentItem, CommentListResponse, ReplyItem, ReplyListResponse } from "@/lib/types";

const BODY_MAX = 2000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Singapore", hour12: false });
}

/** 纯文本展示（保留换行）；React 默认转义防 XSS。 */
function CommentBody({ text }: { text: string }) {
  return <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>;
}

interface ReplyState {
  items: ReplyItem[];
  nextCursor: string | null;
  expanded: boolean;
  loading: boolean;
}

export function CommentSection({ slug }: { slug: string }) {
  const [ctx, setCtx] = useState<CommentContext | null>(null);
  const [roots, setRoots] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, ReplyState>>({});
  const [replyTarget, setReplyTarget] = useState<{ id: string; username: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const active = useRef(false);

  const loginHref = `/login?returnTo=${encodeURIComponent(`/p/${slug}`)}`;

  const loadLiked = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/comments/liked?ids=${ids.join(",")}`, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { liked: string[] };
      setLiked((prev) => new Set([...prev, ...data.liked]));
    } catch {
      /* 点赞状态失败不阻塞阅读 */
    }
  }, []);

  const loadRoots = useCallback(
    async (cursor: string | null) => {
      const res = await fetch(`/api/contents/${slug}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as CommentListResponse;
      setRoots((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      void loadLiked(data.items.filter((i) => !i.deleted).map((i) => i.id));
    },
    [slug, loadLiked],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ctxRes] = await Promise.all([
        fetch(`/api/contents/${slug}/comments/context`, { cache: "no-store", credentials: "same-origin" }),
        loadRoots(null),
      ]);
      if (ctxRes.ok) setCtx((await ctxRes.json()) as CommentContext);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug, loadRoots]);

  useEffect(() => {
    if (active.current) return;
    active.current = true;
    void loadAll();
  }, [loadAll]);

  async function toggleReplies(rootId: string) {
    const cur = replies[rootId];
    if (cur?.expanded) {
      setReplies((p) => ({ ...p, [rootId]: { ...cur, expanded: false } }));
      return;
    }
    setReplies((p) => ({ ...p, [rootId]: { items: cur?.items ?? [], nextCursor: cur?.nextCursor ?? null, expanded: true, loading: true } }));
    await loadReplies(rootId, cur?.nextCursor ?? null, cur?.items ?? []);
  }

  async function loadReplies(rootId: string, cursor: string | null, existing: ReplyItem[]) {
    try {
      const res = await fetch(`/api/comments/${rootId}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ReplyListResponse;
      const items = cursor ? [...existing, ...data.items] : data.items;
      setReplies((p) => ({ ...p, [rootId]: { items, nextCursor: data.nextCursor, expanded: true, loading: false } }));
      void loadLiked(data.items.filter((i) => !i.deleted).map((i) => i.id));
    } catch {
      setReplies((p) => ({ ...p, [rootId]: { ...(p[rootId] ?? { items: [], nextCursor: null }), expanded: true, loading: false } }));
    }
  }

  async function submit() {
    if (!ctx?.canInteract || submitting) return;
    const body = draft.trim();
    if ([...body].length < 1 || [...body].length > BODY_MAX) {
      setSubmitError(`评论需为 1-${BODY_MAX} 字`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/contents/${slug}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(replyTarget ? { body, replyToId: replyTarget.id } : { body }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) {
        setSubmitError(data?.error?.message ?? "发送失败，请重试");
        return;
      }
      setDraft("");
      const target = replyTarget;
      setReplyTarget(null);
      if (target) {
        // 回复：刷新根列表（回复数变化）并展开所在根的回复（parentId 由服务端决定，扁平化挂根）
        const created = data as { parentId?: string | null } | null;
        const rootId = created?.parentId ?? target.id;
        await loadRoots(null);
        await loadReplies(rootId, null, []);
      } else {
        await loadRoots(null);
      }
    } catch {
      setSubmitError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(item: { id: string }) {
    if (!ctx?.authenticated) {
      window.location.assign(loginHref);
      return;
    }
    if (!ctx.canInteract) return;
    const isLiked = liked.has(item.id);
    const res = await fetch(`/api/comments/${item.id}/like`, { method: isLiked ? "DELETE" : "PUT", credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { likeCount: number };
    setLiked((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    const patch = <T extends { id: string; likeCount: number }>(list: T[]): T[] => list.map((x) => (x.id === item.id ? { ...x, likeCount: data.likeCount } : x));
    setRoots((prev) => patch(prev));
    setReplies((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, items: patch(v.items) }])));
  }

  async function remove(id: string) {
    if (!window.confirm("确定删除这条评论吗？")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) await loadRoots(null);
  }

  function canManage(item: CommentItem | ReplyItem): boolean {
    return !!ctx?.me && (ctx.me.role === "admin" || ctx.me.username === item.author?.username);
  }

  function renderActions(item: CommentItem | ReplyItem, rootId: string | null) {
    if (item.deleted) return null;
    return (
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <button
          type="button"
          aria-label={liked.has(item.id) ? "取消点赞" : "点赞"}
          aria-pressed={liked.has(item.id)}
          onClick={() => void toggleLike(item)}
          className={`inline-flex items-center gap-1 ${ctx?.canInteract || !ctx?.authenticated ? "hover:text-foreground" : "cursor-not-allowed opacity-60"}`}
        >
          <Heart className={`size-3.5 ${liked.has(item.id) ? "fill-current text-red-500" : ""}`} />
          {item.likeCount}
        </button>
        {ctx?.authenticated && ctx.canInteract && (
          <button type="button" className="hover:text-foreground" onClick={() => setReplyTarget({ id: item.id, username: item.author?.username ?? "用户" })}>
            回复
          </button>
        )}
        {canManage(item) && (
          <button type="button" className="hover:text-red-500" onClick={() => void remove(item.id)}>
            删除
          </button>
        )}
        {rootId === null && (item as CommentItem).replyCount > 0 && (
          <button type="button" className="hover:text-foreground" onClick={() => void toggleReplies(item.id)}>
            {replies[item.id]?.expanded ? "收起回复" : `查看 ${(item as CommentItem).replyCount} 条回复`}
          </button>
        )}
      </div>
    );
  }

  function renderReply(item: ReplyItem, rootId: string) {
    return (
      <div key={item.id} id={`comment-${item.id}`} className="py-2">
        {item.deleted ? (
          <p className="text-sm text-muted-foreground">评论已删除</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.author?.username}</span>
              {item.replyTo && <span>回复 @{item.replyTo.username ?? "已删除"}</span>}
              <time>{fmtTime(item.createdAt)}</time>
            </div>
            <CommentBody text={item.body ?? ""} />
          </>
        )}
        {renderActions(item, rootId)}
      </div>
    );
  }

  return (
    <section className="mt-12 border-t pt-8" aria-label="评论区">
      <h2 className="text-lg font-medium">评论{total > 0 ? `（${total}）` : ""}</h2>

      {/* 输入区：按互动上下文呈现 */}
      <div className="mt-4">
        {!ctx || !ctx.authenticated ? (
          <p className="text-sm text-muted-foreground">
            <a href={loginHref} className="underline underline-offset-4">登录</a> 后参与评论
          </p>
        ) : !ctx.canInteract ? (
          <p className="text-sm text-muted-foreground">此为付费内容，解锁完整权益后可参与评论与点赞。</p>
        ) : (
          <div className="space-y-2">
            {replyTarget && (
              <p className="text-xs text-muted-foreground">
                回复 @{replyTarget.username}{" "}
                <button type="button" className="underline" onClick={() => setReplyTarget(null)}>
                  取消
                </button>
              </p>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={BODY_MAX * 2}
              placeholder={replyTarget ? "写下你的回复…" : "写下你的评论…"}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              aria-label="评论输入框"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {[...draft].length}/{BODY_MAX}
              </span>
              <Button size="sm" onClick={() => void submit()} disabled={submitting || draft.trim().length === 0}>
                {submitting ? "发送中…" : "发送"}
              </Button>
            </div>
            {submitError && (
              <p role="alert" className="text-sm text-red-500">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 列表 */}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">评论加载中…</p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-red-500">
          评论加载失败。
          <button className="underline" onClick={() => void loadAll()}>
            重试
          </button>
        </p>
      ) : roots.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">还没有评论。</p>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {roots.map((item) => (
            <div key={item.id} id={`comment-${item.id}`} className="py-4">
              {item.deleted ? (
                <p className="text-sm text-muted-foreground">评论已删除</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.author?.username}</span>
                    <time>{fmtTime(item.createdAt)}</time>
                  </div>
                  <CommentBody text={item.body ?? ""} />
                </>
              )}
              {renderActions(item, null)}
              {replies[item.id]?.expanded && (
                <div className="ml-4 mt-2 border-l pl-4">
                  {(replies[item.id]?.items ?? []).map((r) => renderReply(r, item.id))}
                  {replies[item.id]?.loading && <p className="py-2 text-xs text-muted-foreground">加载中…</p>}
                  {replies[item.id]?.nextCursor && !replies[item.id]?.loading && (
                    <button
                      type="button"
                      className="py-1 text-xs text-muted-foreground underline"
                      onClick={() => {
                        const st = replies[item.id];
                        if (st?.nextCursor) void loadReplies(item.id, st.nextCursor, st.items);
                      }}
                    >
                      加载更多回复
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {nextCursor && !loading && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadRoots(nextCursor)}>
            加载更多评论
          </Button>
        </div>
      )}
    </section>
  );
}
