/**
 * Analytics React 埋点组件（指标口径见 docs/analytics.md）：
 * - AnalyticsListProvider：一个列表浏览实例（首页 / 合集列表页）的上下文，
 *   提供 placement 与该实例的 pageViewId；无 Provider 的表面（如标签页）不采集。
 * - TrackImpression：IntersectionObserver 判定卡片可视面积 ≥50% 且连续可见 ≥1s，
 *   页面切后台暂停计时、离开视口重置；同一浏览实例对同一 target 最多一次。
 * - TrackClickLink：仅包裹标题/封面入口，onClick 记 click，不干扰 Link 导航与预取。
 * - DetailTracker：详情页 mount 记一次 view（SSR/Prefetch 不执行客户端 effect，不会虚增）；
 *   Page Visibility 累计前台停留 ≥10s 记一次 read，切后台暂停。
 */
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  analyticsDisabled,
  trackEvent,
  trackOnce,
  type AnalyticsPlacement,
  type AnalyticsTargetKind,
} from "@/lib/analytics";

const IMPRESSION_MIN_RATIO = 0.5;
const IMPRESSION_MIN_VISIBLE_MS = 1_000;
const READ_MIN_VISIBLE_MS = 10_000;

interface ListContextValue {
  placement: AnalyticsPlacement;
  listViewId: string;
}

const AnalyticsListContext = createContext<ListContextValue | null>(null);

export function AnalyticsListProvider({ placement, children }: { placement: AnalyticsPlacement; children: ReactNode }) {
  // useState 初始化器在 Strict Mode 双重挂载间保持稳定，一个浏览实例只生成一个 id
  const [listViewId] = useState(() => crypto.randomUUID());
  const value = useMemo(() => ({ placement, listViewId }), [placement, listViewId]);
  return <AnalyticsListContext.Provider value={value}>{children}</AnalyticsListContext.Provider>;
}

interface TrackableProps {
  targetKind: AnalyticsTargetKind;
  targetId: string;
  children: ReactNode;
}

export function TrackImpression({ targetKind, targetId, children }: TrackableProps) {
  const ctx = useContext(AnalyticsListContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx || analyticsDisabled()) return;
    const el = ref.current;
    if (!el) return;

    let intersecting = false;
    let timer: number | null = null;

    const cancelTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const tryArm = () => {
      if (timer !== null) return; // 计时中不重置：跨越更高阈值（如 0.6 → 1.0）不重新开始计时
      if (!intersecting || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        timer = null;
        // 回调时再次确认仍满足条件（期间可能切后台/滑出）
        if (intersecting && document.visibilityState === "visible") {
          trackOnce(`imp:${ctx.listViewId}:${targetId}`, {
            eventType: "impression",
            targetKind,
            targetId,
            placement: ctx.placement,
            pageViewId: ctx.listViewId,
          });
        }
      }, IMPRESSION_MIN_VISIBLE_MS);
    };

    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some((e) => e.intersectionRatio >= IMPRESSION_MIN_RATIO);
        if (intersecting) tryArm();
        else cancelTimer(); // 低于 50% 才取消计时
      },
      { threshold: [0, IMPRESSION_MIN_RATIO] },
    );
    io.observe(el);

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryArm();
      else cancelTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelTimer();
    };
  }, [ctx, targetKind, targetId]);

  // 无 Provider 的表面（标签页等）不采集，仅透传布局
  return <div ref={ref}>{children}</div>;
}

export function TrackClickLink({
  targetKind,
  targetId,
  href,
  className,
  children,
}: TrackableProps & { href: string; className?: string }) {
  const ctx = useContext(AnalyticsListContext);
  const send = () => {
    if (!ctx) return;
    trackEvent({ eventType: "click", targetKind, targetId, placement: ctx.placement, pageViewId: ctx.listViewId });
  };
  return (
    <Link
      href={href}
      className={className}
      onClick={send}
      // 鼠标中键新标签打开走 auxclick（button=1），同样是主动点击入口；右键（button=2）不计
      onAuxClick={(e) => {
        if (e.button === 1) send();
      }}
    >
      {children}
    </Link>
  );
}

export function DetailTracker({ targetKind, targetId }: { targetKind: AnalyticsTargetKind; targetId: string }) {
  const [pageViewId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (analyticsDisabled()) return;

    trackOnce(`view:${pageViewId}`, { eventType: "view", targetKind, targetId, pageViewId });

    // read：前台累计可见 ≥10s；切后台暂停累计，回前台继续
    let accumulated = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? performance.now() : null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      trackOnce(`read:${pageViewId}`, { eventType: "read", targetKind, targetId, pageViewId });
    };
    const check = () => {
      const total = accumulated + (visibleSince !== null ? performance.now() - visibleSince : 0);
      if (total >= READ_MIN_VISIBLE_MS) finish();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          accumulated += performance.now() - visibleSince;
          visibleSince = null;
        }
      } else if (visibleSince === null) {
        visibleSince = performance.now();
      }
      check();
    };

    const interval = window.setInterval(check, 500);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pageViewId, targetKind, targetId]);

  return null;
}
