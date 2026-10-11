/**
 * 数据库 Schema —— 与 docs/architecture.md §5 一一对应。
 * 语义约定（订阅区间链、撤销单调字段、exposure 合同等）见 ADR-0002/0004/0006。
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  inet,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

/** citext：不区分大小写的文本（email） */
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull(),
    username: citext("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
    status: text("status", { enum: ["pending", "active", "disabled"] }).notNull().default("pending"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), uniqueIndex("users_username_unique").on(t.username)],
);

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: citext("email").notNull(),
  purpose: text("purpose", { enum: ["register", "password_reset"] }).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_id_idx").on(t.userId)],
);

export const contents = pgTable(
  "contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: ["article", "image", "video", "audio"] }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    visibility: text("visibility", { enum: ["public", "paid"] }).notNull().default("public"),
    previewMode: text("preview_mode", { enum: ["full", "percent", "marker", "none"] }).notNull().default("none"),
    previewPercent: integer("preview_percent"),
    coverMediaId: uuid("cover_media_id").references((): any => mediaAssets.id),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contents_slug_unique").on(t.slug),
    index("contents_status_published_at_idx").on(t.status, t.publishedAt),
    check("contents_preview_percent_range", sql`${t.previewPercent} between 1 and 99`),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 内容寻址：media/<sha256>.<ext>（ADR-0006） */
    ossKey: text("oss_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    durationSec: integer("duration_sec"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_assets_oss_key_unique").on(t.ossKey)],
);

export const contentMedia = pgTable(
  "content_media",
  {
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id),
    position: integer("position").notNull(),
    /** 发布期由截断函数计算（ADR-0004） */
    exposure: text("exposure", { enum: ["free", "paid"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.mediaId] }), index("content_media_media_id_idx").on(t.mediaId)],
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    visibility: text("visibility", { enum: ["public", "paid"] }).notNull().default("public"),
    coverMediaId: uuid("cover_media_id").references((): any => mediaAssets.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("collections_slug_unique").on(t.slug)],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.contentId] }), index("collection_items_content_id_idx").on(t.contentId)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_slug_unique").on(t.slug)],
);

export const contentTags = pgTable(
  "content_tags",
  {
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.tagId] }), index("content_tags_tag_id_idx").on(t.tagId)],
);

export const activationCodes = pgTable(
  "activation_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    batchId: uuid("batch_id").notNull(),
    grantType: text("grant_type", { enum: ["content", "collection", "subscription"] }).notNull(),
    grantContentId: uuid("grant_content_id"),
    grantCollectionId: uuid("grant_collection_id"),
    /** 权益有效期天数；null = 长期；subscription 必填 */
    grantDays: integer("grant_days"),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    /** 码本身的有效期（非权益有效期） */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activation_codes_code_unique").on(t.code),
    check("activation_codes_subscription_days", sql`${t.grantType} <> 'subscription' or ${t.grantDays} is not null`),
    check("activation_codes_content_ref", sql`${t.grantType} <> 'content' or ${t.grantContentId} is not null`),
    check("activation_codes_collection_ref", sql`${t.grantType} <> 'collection' or ${t.grantCollectionId} is not null`),
  ],
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => activationCodes.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("redemptions_code_user_unique").on(t.codeId, t.userId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    scopeType: text("scope_type", { enum: ["content", "collection", "subscription"] }).notNull(),
    /** content/collection 的 id；subscription 恒为 null */
    scopeId: uuid("scope_id"),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
    /** null = 永久 */
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    /** 1:1，授予事实不可变 */
    redemptionId: uuid("redemption_id")
      .notNull()
      .references(() => redemptions.id),
    /** 单调状态字段：NULL → 值，不可逆（ADR-0002） */
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedBy: uuid("revoked_by"),
    revokeReason: text("revoke_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entitlements_redemption_id_unique").on(t.redemptionId),
    index("entitlements_user_scope_idx").on(t.userId, t.scopeType, t.scopeId),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type ContentMedia = typeof contentMedia.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ActivationCode = typeof activationCodes.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
