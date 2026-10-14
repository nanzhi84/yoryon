/**
 * Analytics 浏览器采集核心（ADR-0007，指标口径见 docs/analytics.md）。
 * - 事件先入内存队列，小批量异步提交到同源 BFF：普通 flush 用 fetch(keepalive)，
 *   页面隐藏/卸载与点击（可能伴随导航）用 sendBeacon；
 * - 失败有界重试一次（复用同一 event_id，服务端按 event_id 幂等去重），随后丢弃——
 *   采集失败绝不阻塞内容展示与导航；
 * - 隐私：尊重 DNT / GPC；visitor_id 为主机限定 180 天 Cookie 的随机 UUID，
 *   session_id 为 sessionStorage 标签页会话，page_view_id 为当前浏览实例。
 */
"use client";

import { analyticsDisabled, prepareVisitorIdentity, readVisitorId, visitorPreparation } from "./analytics-visitor";
export { analyticsDisabled } from "./analytics-visitor";

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
  /** 首次投递前读取共享 Cookie，重试保留原事件身份。undefined 表示尚未投递。 */
  visitorId?: string | null;
  /** 已重投次数（不进入请求体） */
  requeues: number;
}

const ENDPOINT = "/api/analytics/events";
const FLUSH_INTERVAL_MS = 2_000;
const DETAIL_FLUSH_INTERVAL_MS = 12_000; // view 与前台 10s read 合批；离页/隐藏仍立即 beacon。
const MAX_BATCH = 20; // 与服务端 ANALYTICS_MAX_BATCH 一致
const MAX_REQUEUES = 1;
const SESSION_KEY = "yoryon_analytics_sid";

const queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

/** 同一浏览实例内已发送的 impression/view 去重键（防御 Strict Mode 与 effect 重放） */
const sentOnceKeys = new Set<string>();

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
  const identityReady = prepareVisitorIdentity();
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
    void identityReady.then(() => flush("beacon")); // 锁内身份就绪后投递；离页监听仍同步 beacon
  } else {
    scheduleFlush(input.eventType === "view" ? DETAIL_FLUSH_INTERVAL_MS : FLUSH_INTERVAL_MS);
  }
}

/** 幂等事件（impression/view/read）：同一浏览实例内只发送一次。 */
export function trackOnce(key: string, input: TrackInput): void {
  if (sentOnceKeys.has(key)) return;
  sentOnceKeys.add(key);
  trackEvent(input);
}

function scheduleFlush(delay = FLUSH_INTERVAL_MS): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush("fetch");
  }, delay);
}

function flush(mode: "fetch" | "beacon"): void {
  if (mode === "beacon" && flushTimer !== null) { window.clearTimeout(flushTimer); flushTimer = null; }
  if (analyticsDisabled()) { queue.length = 0; return; }
  if (queue.length === 0) return;
  if (mode === "fetch" && flushing) return;
  const preparing = visitorPreparation();
  if (mode === "fetch" && preparing) {
    void preparing.then(() => flush("fetch"));
    return;
  }
  const batch = queue.splice(0, MAX_BATCH);
  const currentVisitor = readVisitorId();
  for (const event of batch) if (event.visitorId === undefined) event.visitorId = currentVisitor;
  const body = JSON.stringify({ events: batch.map(({ requeues: _r, ...e }) => e) });

  if (mode === "beacon") {
    // sendBeacon 在页面卸载路径上最可靠；失败（返回 false）重入队并调度一次 fetch 重投（有界）
    const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    if (!ok) {
      requeue(batch);
      scheduleFlush();
    }
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
