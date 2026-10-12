"use client";

/** 评论读取边界：根列表请求代次、线程分页、点赞查询版本及有界锚点定位。 */
import { useCallback, useRef, useState } from "react";
import type { CommentItem, CommentListResponse, ReplyItem, ReplyListResponse } from "@/lib/types";

const LOCATE_MAX_PAGES = 10;
export interface ReplyState {
  items: ReplyItem[];
  nextCursor: string | null;
  expanded: boolean;
  loading: boolean;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function useCommentData(slug: string) {
  const [roots, setRoots] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, ReplyState>>({});
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const rootGeneration = useRef(0);
  const requestScope = useRef(0);
  const replyGenerations = useRef(new Map<string, number>());
  const likeQueries = useRef(new Map<string, number>());
  const likeWrites = useRef(new Map<string, number>());
  const pendingLikes = useRef(new Set<string>());
  const controllers = useRef(new Set<AbortController>());

  const fetchJson = useCallback(async <T,>(url: string): Promise<T> => {
    const controller = new AbortController();
    controllers.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json() as T;
    } finally {
      clearTimeout(timeout);
      controllers.current.delete(controller);
    }
  }, []);

  const cancelRequests = useCallback(() => {
    rootGeneration.current++;
    requestScope.current++;
    replyGenerations.current.clear();
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);
  const currentGeneration = useCallback(() => rootGeneration.current, []);
  const isCurrent = useCallback((generation: number) => generation === rootGeneration.current, []);

  /** 批替换只接受最新查询且查询发起后没有本地写操作的 id。 */
  const loadLiked = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const generation = rootGeneration.current;
    const versions = ids.map((id) => {
      const query = (likeQueries.current.get(id) ?? 0) + 1;
      likeQueries.current.set(id, query);
      return { id, query, write: likeWrites.current.get(id) ?? 0 };
    });
    try {
      const data = await fetchJson<{ liked: string[] }>(`/api/comments/liked?ids=${ids.join(",")}`);
      const returned = new Set(data.liked);
      setLiked((prev) => {
        if (!isCurrent(generation)) return prev;
        const next = new Set(prev);
        for (const { id, query, write } of versions) {
          if (likeQueries.current.get(id) !== query || (likeWrites.current.get(id) ?? 0) !== write || pendingLikes.current.has(id)) continue;
          if (returned.has(id)) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    } catch {
      // 辅助状态失败不阻塞公开阅读；本地已成功互动的状态不回滚。
    }
  }, [fetchJson, isCurrent]);

  const beginLike = useCallback((id: string) => {
    if (pendingLikes.current.has(id)) return false;
    pendingLikes.current.add(id);
    likeWrites.current.set(id, (likeWrites.current.get(id) ?? 0) + 1);
    return true;
  }, []);
  const commitLike = useCallback((id: string, value: boolean) => {
    likeWrites.current.set(id, (likeWrites.current.get(id) ?? 0) + 1);
    setLiked((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const endLike = useCallback((id: string) => { pendingLikes.current.delete(id); }, []);

  /** 首页重载创建新代次；翻页与定位沿用代次。迟到的旧页不得修改条目或游标。 */
  const loadRoots = useCallback(async (cursor: string | null, expectedGeneration?: number) => {
    const generation = expectedGeneration ?? (cursor ? rootGeneration.current : ++rootGeneration.current);
    if (!cursor && expectedGeneration === undefined) {
      setLocating(false);
      setLocateError(null);
    }
    const data = await fetchJson<CommentListResponse>(`/api/contents/${slug}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!isCurrent(generation)) return null;
    setRoots((prev) => isCurrent(generation) ? dedupeById(cursor ? [...prev, ...data.items] : data.items) : prev);
    setTotal(data.total);
    setNextCursor(data.nextCursor);
    void loadLiked(data.items.filter((item) => !item.deleted).map((item) => item.id));
    return data;
  }, [slug, fetchJson, isCurrent, loadLiked]);

  const loadReplies = useCallback(async (rootId: string, cursor: string | null, existing: ReplyItem[], expectedRootGeneration?: number) => {
    const scope = requestScope.current;
    const generation = cursor ? (replyGenerations.current.get(rootId) ?? 0) : (replyGenerations.current.get(rootId) ?? 0) + 1;
    replyGenerations.current.set(rootId, generation);
    const data = await fetchJson<ReplyListResponse>(`/api/comments/${rootId}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    const valid = () => requestScope.current === scope && replyGenerations.current.get(rootId) === generation && (expectedRootGeneration === undefined || isCurrent(expectedRootGeneration));
    if (!valid()) return null;
    const items = dedupeById(cursor ? [...existing, ...data.items] : data.items);
    setReplies((prev) => valid() ? { ...prev, [rootId]: { items, nextCursor: data.nextCursor, expanded: true, loading: false } } : prev);
    void loadLiked(data.items.filter((item) => !item.deleted).map((item) => item.id));
    return { ...data, items };
  }, [fetchJson, isCurrent, loadLiked]);

  /** 先确保所属根进入 DOM，再累积翻回复页；过期序列或达到上界时明确告知而非静默滚动失败。 */
  const locateHash = useCallback(async (firstPage: CommentListResponse, generation: number) => {
    const match = /^#comment-([0-9a-f-]{36})$/i.exec(window.location.hash);
    if (!match || !isCurrent(generation)) return;
    setLocating(true);
    setLocateError(null);
    try {
      const loc = await fetchJson<{ id: string; rootId: string; contentSlug: string }>(`/api/comments/${match[1]}/locate`);
      if (!isCurrent(generation)) return;
      if (loc.contentSlug !== slug) throw new Error("wrong content");
      let rootFound = firstPage.items.some((item) => item.id === loc.rootId);
      let cursor = firstPage.nextCursor;
      for (let page = 1; page < LOCATE_MAX_PAGES && cursor && !rootFound; page++) {
        const data = await loadRoots(cursor, generation);
        if (!data) return;
        rootFound = data.items.some((item) => item.id === loc.rootId);
        cursor = data.nextCursor;
      }
      if (!rootFound) throw new Error("root outside locate limit");
      if (loc.rootId !== loc.id) {
        let accumulated: ReplyItem[] = [];
        cursor = null;
        let found = false;
        for (let page = 0; page < LOCATE_MAX_PAGES && !found; page++) {
          const data = await loadReplies(loc.rootId, cursor, accumulated, generation);
          if (!data) return;
          accumulated = data.items;
          found = accumulated.some((item) => item.id === loc.id);
          cursor = data.nextCursor;
          if (!cursor) break;
        }
        if (!found) throw new Error("reply outside locate limit");
      }
      // 等待 React 提交列表；定位过程不允许普通分页并发写入。
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (isCurrent(generation)) document.getElementById(`comment-${loc.id}`)?.scrollIntoView({ block: "center" });
      }));
    } catch {
      if (isCurrent(generation)) setLocateError("未能定位该评论，请展开回复或继续翻页查找。");
    } finally {
      if (isCurrent(generation)) setLocating(false);
    }
  }, [slug, fetchJson, isCurrent, loadRoots, loadReplies]);

  return {
    roots, total, nextCursor, liked, replies, setReplies, locating, locateError,
    loadRoots, loadReplies, locateHash, beginLike, commitLike, endLike,
    cancelRequests, currentGeneration, isCurrent,
  };
}
