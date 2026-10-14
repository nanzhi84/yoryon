import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Analytics 事件表（ADR-0007）：原始事件，多态 target（work→contents / collection→collections）。
 * target_id 故意不设外键：作品/合集删除后历史统计保留；合法性由写入路径（ingest API）在应用层校验。
 * 不存 IP / UA / 完整 URL；session_id 为标签页会话，visitor_id 为随机 Cookie 身份。
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 客户端生成的幂等键：重试/重复投递去重 */
    eventId: uuid("event_id").notNull(),
    eventType: text("event_type", { enum: ["impression", "click", "view", "read"] }).notNull(),
    targetKind: text("target_kind", { enum: ["work", "collection"] }).notNull(),
    targetId: uuid("target_id").notNull(),
    /** 仅 impression/click 携带；view/read 恒为 null */
    placement: text("placement", { enum: ["home_feed", "collection_list"] }),
    pageViewId: uuid("page_view_id").notNull(),
    sessionId: uuid("session_id"),
    /** 主机限定 Cookie 中的随机身份；历史/拒绝存储客户端允许缺省，不关联账号。 */
    visitorId: uuid("visitor_id"),
    /** 服务端可信接收时间（统计一律以它为准，不信任客户端时钟） */
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("analytics_events_event_id_unique").on(t.eventId),
    index("analytics_events_target_time_idx").on(t.targetKind, t.targetId, t.receivedAt),
    index("analytics_events_received_at_idx").on(t.receivedAt),
    index("analytics_events_visitor_time_idx").on(t.visitorId, t.receivedAt),
  ],
);

/** 最小首次观察账本（ADR-0017），不随原始事件 prune 删除，避免误判老访客为新访客。 */
export const analyticsVisitors = pgTable("analytics_visitors", {
  visitorId: uuid("visitor_id").primaryKey(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "date" }).notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
