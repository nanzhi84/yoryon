/**
 * Analytics ingest（ADR-0007）：POST /api/analytics/events。
 * - Zod 白名单校验 + 单批上限 + IP 维度限流；
 * - event_id 唯一约束幂等去重（客户端有界重试安全）；
 * - 目标合法性在应用层校验：work 必须已发布、collection 必须存在；非法目标静默丢弃，
 *   仍返回 200（采集不是业务关键路径，不给客户端重试信号）；
 * - 不写 IP/UA/URL；received_at 由服务端生成（defaultNow），不信任客户端时钟。
 */
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ANALYTICS_MAX_BATCH, RATE_LIMITS } from "@yoryon/config";
import { readBodyCapped } from "@yoryon/core";
import { analyticsEvents, collections, contents } from "@yoryon/db";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import type { AppVariables } from "../middleware/auth";

const eventSchema = z.object({
  eventId: z.uuid(),
  eventType: z.enum(["impression", "click", "view", "read"]),
  targetKind: z.enum(["work", "collection"]),
  targetId: z.uuid(),
  placement: z.enum(["home_feed", "collection_list"]).nullish(),
  pageViewId: z.uuid(),
  sessionId: z.uuid().nullish(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(ANALYTICS_MAX_BATCH),
});

/** 请求体字节上限：批量条数上限不能约束单条体积，匿名入口必须在解析前拦截大载荷 */
const MAX_BODY_BYTES = 32 * 1024;

/**
 * 列表表面与 Target 的唯一对应（ADR-0007 §4）：首页 feed 只有 Work，合集只在 /c 列表曝光。
 * impression/click 的 placement 不一致 = 伪造/异常事件，静默丢弃（采集不是关键路径）。
 */
const CANONICAL_PLACEMENT = { work: "home_feed", collection: "collection_list" } as const;

export function analyticsRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/analytics/events", async (c) => {
    const ip = c.get("clientIp")?.ip ?? "unknown";
    const factor = (ip === "unknown" ? 0.5 : 1) * deps.env.RATE_LIMIT_SCALE;
    const retryAfter = deps.rateLimiter.consume(
      `analytics:${ip}`,
      Math.max(1, Math.floor(RATE_LIMITS.analyticsBatchPerIpPerMinute * factor)),
      60_000,
    );
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, 429, "rate_limited", "请求过于频繁，请稍后再试");
    }

    // 字节上限：有上限流式读取（Content-Length 预检 + 逐 chunk 字节累计），
    // chunked 无声明长度也能在 EOF 前中止；多字节字符不会绕过（按 byteLength 计）
    const raw = await readBodyCapped(c.req.raw, MAX_BODY_BYTES);
    if (raw === null) return errorResponse(c, 413, "payload_too_large", "请求体过大");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse(c, 400, "invalid_json", "请求体不是合法 JSON");
    }
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return errorResponse(c, 400, "invalid_events", "事件格式不合法");

    // 语义归一：impression/click 必须声明列表来源且与 target kind 的唯一表面对应；
    // view/read 不属于任何列表，placement 恒为 null。uuid 归一小写（z.uuid 接受大写，与库返回的小写 id 比较需一致）
    const events = [];
    for (const e of parsed.data.events) {
      const normalized = { ...e, targetId: e.targetId.toLowerCase() };
      if (e.eventType === "impression" || e.eventType === "click") {
        if (!e.placement) return errorResponse(c, 400, "invalid_events", "impression/click 必须携带 placement");
        if (e.placement !== CANONICAL_PLACEMENT[e.targetKind]) continue; // 跨表面事件静默丢弃
        events.push({ ...normalized, placement: e.placement });
      } else {
        events.push({ ...normalized, placement: null });
      }
    }

    // 多态 target 应用层校验（无 FK：目标删除后历史统计保留，见 schema 注释）
    const workIds = [...new Set(events.filter((e) => e.targetKind === "work").map((e) => e.targetId))];
    const collectionIds = [...new Set(events.filter((e) => e.targetKind === "collection").map((e) => e.targetId))];
    const validTargets = new Set<string>();
    if (workIds.length) {
      const rows = await deps.db
        .select({ id: contents.id })
        .from(contents)
        .where(and(inArray(contents.id, workIds), eq(contents.status, "published")));
      for (const r of rows) validTargets.add(`work:${r.id}`);
    }
    if (collectionIds.length) {
      const rows = await deps.db.select({ id: collections.id }).from(collections).where(inArray(collections.id, collectionIds));
      for (const r of rows) validTargets.add(`collection:${r.id}`);
    }

    const rows = events
      .filter((e) => validTargets.has(`${e.targetKind}:${e.targetId}`))
      .map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        targetKind: e.targetKind,
        targetId: e.targetId,
        placement: e.placement,
        pageViewId: e.pageViewId,
        sessionId: e.sessionId ?? null,
      }));
    if (rows.length) {
      await deps.db.insert(analyticsEvents).values(rows).onConflictDoNothing({ target: analyticsEvents.eventId });
    }
    return c.json({ accepted: rows.length });
  });

  return app;
}
