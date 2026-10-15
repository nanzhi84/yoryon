"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { analyticsDisabled, trackOnce } from "@/lib/analytics";
import { TrackImpression, useAnalyticsList } from "./analytics";

const PostReadContext = createContext<(() => void) | null>(null);
export function usePostRead() { return useContext(PostReadContext); }

/** 帖子阅读属于列表实例；展开与五秒可见停留使用相同去重键。 */
export function PostAnalytics({ id, children }: { id: string; children: ReactNode }) {
  const list = useAnalyticsList();
  const host = useRef<HTMLDivElement>(null);
  const progress = useRef({ elapsed: 0, done: false });
  const stop = useRef<(() => void) | null>(null);
  const read = useCallback(() => {
    if (!list || list.placement !== "home_feed" || analyticsDisabled() || document.visibilityState !== "visible") return;
    if (progress.current.done) return;
    progress.current.done = true;
    stop.current?.();
    trackOnce(`post-read:${list.listViewId}:${id}`, {
      eventType: "read", targetKind: "work", targetId: id,
      placement: "home_feed", pageViewId: list.listViewId,
    });
  }, [id, list]);

  useEffect(() => {
    const element = host.current;
    if (!element || !list || list.placement !== "home_feed" || analyticsDisabled()) return;
    let intersecting = false;
    let since: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pause = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (since !== null) { progress.current.elapsed += performance.now() - since; since = null; }
    };
    stop.current = pause;
    const update = () => {
      pause();
      if (progress.current.done || !intersecting || document.visibilityState !== "visible") return;
      if (progress.current.elapsed >= 5_000) { read(); return; }
      since = performance.now();
      timer = setTimeout(update, 5_000 - progress.current.elapsed);
    };
    const observer = new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.intersectionRatio >= 0.5);
      update();
    }, { threshold: [0, 0.5] });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      pause(); stop.current = null; observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [list, read]);

  return <TrackImpression targetKind="work" targetId={id}>
    <PostReadContext.Provider value={read}><div ref={host}>{children}</div></PostReadContext.Provider>
  </TrackImpression>;
}
