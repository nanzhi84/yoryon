/**
 * Analytics 浏览器采集核心（ADR-0007，指标口径见 docs/analytics.md）。
 * - 事件先入内存队列，小批量异步提交到同源 BFF：普通 flush 用 fetch(keepalive)，
 *   页面隐藏/卸载与点击（可能伴随导航）用 sendBeacon；
 * - 失败有界重试一次（复用同一 event_id，服务端按 event_id 幂等去重），随后丢弃——
 *   采集失败绝不阻塞内容展示与导航；
 * - 隐私：尊重 DNT / GPC 拒绝追踪信号；不采集 IP/UA/URL；session_id 为 sessionStorage
 *   级短生命周期匿名标识（关标签页即失效）。
 */
"use client";

export type AnalyticsTargetKind = "work" | "collection";
export type AnalyticsEventType = "impression" | "click" | "view" | "read";
export type AnalyticsPlacement = "home_feed" | "collection_list";

export interface TrackInput {
  eventType: AnalyticsEventType;
  targetKind: AnalyticsTargetKind;
  targetId: string;
  /** impression/click 必填；view/read 不传 */
  placement?: AnalyticsPlacement;
  /** 浏览实例 id：列表页由 AnalyticsListProvider 生成，详情页由 DetailTracker 生成 */
  pageViewId: string;
}

interface QueuedEvent {
  eventId: string;
  eventType: AnalyticsEventType;
  targetKind: AnalyticsTargetKind;
  targetId: string;
  placement: AnalyticsPlacement | null;
  pageViewId: string;
  sessionId: string | null;
  /** 已重投次数（不进入请求体） */
  requeues: number;
}

const ENDPOINT = "/api/analytics/events";
const FLUSH_INTERVAL_MS = 2_000;
const MAX_BATCH = 20; // 与服务端 ANALYTICS_MAX_BATCH 一致
const MAX_REQUEUES = 1;
const SESSION_KEY = "yoryon_analytics_sid";

const queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

/** 同一浏览实例内已发送的 impression/view 去重键（防御 Strict Mode 与 effect 重放） */
const sentOnceKeys = new Set<string>();

export function analyticsDisabled(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function sessionId(): string | null {
  try {
    let v = window.sessionStorage.getItem(SESSION_KEY);
    if (!v) {
      v = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, v);
    }
    return v;
  } catch {
    return null; // 隐私模式等禁用存储场景：session_id 缺省
  }
}

export function trackEvent(input: TrackInput): void {
  if (typeof window === "undefined" || analyticsDisabled()) return;
  queue.push({
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    targetKind: input.targetKind,
    targetId: input.targetId,
    placement: input.placement ?? null,
    pageViewId: input.pageViewId,
    sessionId: sessionId(),
    requeues: 0,
  });
  if (input.eventType === "click") {
    flush("beacon"); // 点击常伴随导航，立即投递
  } else {
    scheduleFlush();
  }
}

/** 幂等事件（impression/view/read）：同一浏览实例内只发送一次。 */
export function trackOnce(key: string, input: TrackInput): void {
  if (sentOnceKeys.has(key)) return;
  sentOnceKeys.add(key);
  trackEvent(input);
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush("fetch");
  }, FLUSH_INTERVAL_MS);
}

function flush(mode: "fetch" | "beacon"): void {
  if (queue.length === 0) return;
  if (mode === "fetch" && flushing) return;
  const batch = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ events: batch.map(({ requeues: _r, ...e }) => e) });

  if (mode === "beacon") {
    // sendBeacon 在页面卸载路径上最可靠；失败（返回 false）走有界重投
    const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    if (!ok) requeue(batch);
    return;
  }

  flushing = true;
  fetch(ENDPOINT, {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
  })
    .then((res) => {
      // 4xx/5xx 统一按可重试处理：重投复用 event_id，服务端幂等去重
      if (!res.ok) requeue(batch);
    })
    .catch(() => requeue(batch))
    .finally(() => {
      flushing = false;
      if (queue.length > 0) scheduleFlush();
    });
}

function requeue(batch: QueuedEvent[]): void {
  const retryable = batch.filter((e) => e.requeues < MAX_REQUEUES).map((e) => ({ ...e, requeues: e.requeues + 1 }));
  queue.unshift(...retryable);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush("beacon"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush("beacon");
  });
}
