/**
 * 数据库 Schema —— 与 docs/architecture.md §5 一一对应。
 * 语义约定（订阅区间链、撤销单调字段、exposure 合同等）见 ADR-0002/0004/0006。
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,  uniqueIndex,
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
    /** 展示名：与登录标识 username 分离，允许重名；评论/问答/通知统一展示，未设置回退 username（Issue #15） */
    displayName: text("display_name"),
    /** 头像媒体资产（复用媒体存储/公开图片管线；GC 零引用扫描计入此引用） */
    avatarMediaId: uuid("avatar_media_id").references((): any => mediaAssets.id),
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
    type: text("type", { enum: ["article", "post"] }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    /** 发布事务派生的匿名正文，带版本防止 SQL 修复复用陈旧投影；迁移未回填时为空。 */
    publicPreviewMarkdown: text("public_preview_markdown"),
    previewRevision: uuid("preview_revision"),
    revision: uuid("revision").notNull().defaultRandom(),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    visibility: text("visibility", { enum: ["public", "paid"] }).notNull().default("public"),
    previewMode: text("preview_mode", { enum: ["full", "percent", "marker", "none"] }).notNull().default("none"),
    previewPercent: integer("preview_percent"),
    coverMediaId: uuid("cover_media_id").references((): any => mediaAssets.id),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    /** 首页置顶：post/article 共用；重新发布保留。 */
    isPinned: boolean("is_pinned").notNull().default(false),
    /** 与合集归属及阅读权限独立；迁移保留既有作品为 true。 */
    showInHome: boolean("show_in_home").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contents_slug_unique").on(t.slug),
    index("contents_status_published_at_idx").on(t.status, t.publishedAt),
    uniqueIndex("contents_single_pinned_unique").on(t.isPinned).where(sql`${t.isPinned} = true`),
    check("contents_preview_percent_range", sql`${t.previewPercent} between 1 and 99`),
    check("contents_type_check", sql`${t.type} in ('article', 'post')`),
    check("contents_article_title_check", sql`${t.type} <> 'article' or length(trim(${t.title})) > 0`),
  ],
);

/** 内容点赞独立于评论点赞；唯一键保证同一用户一赞，统计直接从事实行读取。 */
export const contentLikes = pgTable("content_likes", {
  contentId: uuid("content_id").notNull().references(() => contents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.contentId, t.userId] }),
  index("content_likes_user_idx").on(t.userId),
]);

/** referencedId 保留目标身份；删除目标仅清空 FK，不级联删除引用作品。 */
export const contentReferences = pgTable("content_references", {
  contentId: uuid("content_id").notNull().references(() => contents.id, { onDelete: "cascade" }),
  referencedId: uuid("referenced_id").notNull(),
  targetId: uuid("target_id").references(() => contents.id, { onDelete: "set null" }),
}, t => [
  primaryKey({ columns: [t.contentId, t.referencedId] }),
  index("content_references_target_idx").on(t.referencedId),
  check("content_references_no_self", sql`${t.contentId} <> ${t.referencedId}`),
]);

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
    isPinned: boolean("is_pinned").notNull().default(false),
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

export * from "./schema-analytics";

export type User = typeof users.$inferSelect;
/** 生命周期不级联到内容：删除后仍须保留失效与重试证据。 */
export const cacheEvents = pgTable("cache_events", {
  id: uuid("id").primaryKey(),
  payload: text("payload").notNull(),
  state: text("state", { enum: ["pending", "failed", "verified"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "date" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
/** 目录范围的提交版本；与业务变更和 outbox 同事务更新，不依赖 webhook 成功。 */
export const catalogVersions = pgTable("catalog_versions", {
  scope: text("scope").primaryKey(),
  version: uuid("version").notNull(),
});
export type Session = typeof sessions.$inferSelect;

/**
 * 评论（Issue #14；Issue #15 扩展问答目标）：一级评论 parent_id=null；回复挂根评论 parent_id=根 id（展示扁平化，禁止无限递归），
 * reply_to_id 指向直接被回复对象（UI @提示用）。软删除（deleted_at）保留回复占位；
 * 内容/问答删除级联清理评论；用户删除不级联（PG 默认 restrict），历史通知保留。
 * 目标由 target_kind 区分：content → content_id（FK contents），question → question_id（FK member_questions），恰好一个非空。
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id").references(() => contents.id, { onDelete: "cascade" }),
    /** target_kind='question' 时的问答目标（级联随问答删除） */
    questionId: uuid("question_id").references((): any => memberQuestions.id, { onDelete: "cascade" }),
    targetKind: text("target_kind", { enum: ["content", "question"] }).notNull().default("content"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** 根评论 id；一级评论为 null。自引用，不加 onDelete：软删除不存在物理级联。 */
    parentId: uuid("parent_id").references((): any => comments.id),
    /** 直接被回复的评论/回复 id（必须同 target，应用层校验） */
    replyToId: uuid("reply_to_id").references((): any => comments.id),
    body: text("body").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date", precision: 3 }).notNull().default(sql`date_trunc('milliseconds', now())`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    // 根评论分页：where content_id=? and parent_id is null order by like_count desc, created_at desc, id desc（question 目标同理走 question_id）
    index("comments_content_roots_idx").on(t.contentId, t.parentId, t.likeCount, t.createdAt, t.id),
    index("comments_question_roots_idx").on(t.questionId, t.parentId, t.likeCount, t.createdAt, t.id),
    // 回复分页：where parent_id=? order by created_at asc, id asc
    index("comments_parent_created_idx").on(t.parentId, t.createdAt, t.id),
    check("comments_like_count_nonneg", sql`${t.likeCount} >= 0`),
    check(
      "comments_target_xor",
      sql`(${t.targetKind} = 'content' and ${t.contentId} is not null and ${t.questionId} is null) or (${t.targetKind} = 'question' and ${t.questionId} is not null and ${t.contentId} is null)`,
    ),
  ],
);

/** 根评论排序版本：作品和会员问答分别维护，触发器负责同事务推进。 */
export const commentFeedVersions = pgTable("comment_feed_versions", {
  contentId: uuid("content_id").primaryKey().references(() => contents.id, { onDelete: "cascade" }),
  version: bigint("version", { mode: "bigint" }).notNull().default(sql`0`),
});

/** 评论点赞：(comment_id,user_id) 唯一防双赞；计数在事务内维护。 */
export const commentLikes = pgTable(
  "comment_likes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] }), index("comment_likes_user_idx").on(t.userId)],
);

/**
 * 站内通知（Issue #14 V1：reply/like）。event_id 幂等键防重试重复。
 * content_id/comment_id 故意不设外键（同 analytics_events 约定）：作品/评论删除后历史通知保留，
 * 展示时联查不到即视为已下线，不提供跳转。
 * 取消点赞不撤销已发通知（V1 明确策略：通知是已发生事件的记录）。
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: ["reply", "like", "answer"] }).notNull(),
    contentId: uuid("content_id"),
    commentId: uuid("comment_id"),
    /** 问答目标（Issue #15）：answer 通知与问答评论互动通知使用；不设外键，历史通知保留 */
    questionId: uuid("question_id"),
    /** 幂等键：同一互动事件重复插入由唯一索引拒绝 */
    eventId: uuid("event_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date", precision: 3 }).notNull().default(sql`date_trunc('milliseconds', now())`),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("notifications_event_id_unique").on(t.eventId),
    index("notifications_recipient_idx").on(t.recipientUserId, t.createdAt, t.id),
  ],
);

/**
 * 会员问答（Issue #15）：知识星球式公共问答。
 * - 有效订阅会员每自然月（Asia/Shanghai）最多 1 问：唯一索引 (user_id, month_key) 兜底并发。
 * - 默认公开可设私密；公开问答的问题所有人可见，回答仅有效订阅会员可见（提问者本人恒可见）；
 *   私密问答仅提问者与管理员（CLI）可见，不进公开问答流。
 */
export const memberQuestions = pgTable(
  "member_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** 提问所属自然月（Asia/Shanghai，格式 YYYY-MM）；月度配额键 */
    monthKey: text("month_key").notNull(),
    question: text("question").notNull(),
    answer: text("answer"),
    visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"),
    status: text("status", { enum: ["pending", "answered", "hidden"] }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date", precision: 3 }).notNull().default(sql`date_trunc('milliseconds', now())`),
    answeredAt: timestamp("answered_at", { withTimezone: true, mode: "date", precision: 3 }),
    discussionVersion: bigint("discussion_version", { mode: "bigint" }).notNull().default(sql`0`),
    /** 最近活动排序键：提问/回答/新评论时更新 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date", precision: 3 }).notNull().default(sql`date_trunc('milliseconds', now())`),
  },
  (t) => [
    uniqueIndex("member_questions_user_month_unique").on(t.userId, t.monthKey),
    index("member_questions_public_flow_idx").on(t.visibility, t.status, t.updatedAt, t.id),
    check("member_questions_month_format", sql`${t.monthKey} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("member_questions_question_length", sql`char_length(btrim(${t.question})) between 1 and 500`),
    check("member_questions_visibility", sql`${t.visibility} in ('public', 'private')`),
    check("member_questions_status", sql`${t.status} in ('pending', 'answered', 'hidden')`),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type MemberQuestion = typeof memberQuestions.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type ContentMedia = typeof contentMedia.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ActivationCode = typeof activationCodes.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;

/** Issue #23 derived search text; rebuildable, never an entitlement source. */
export const searchProjections = pgTable('search_projections', {
  contentId: uuid('content_id').primaryKey().references(() => contents.id, { onDelete: 'cascade' }),
  revision: uuid('revision').notNull(),
  title: text('title').notNull(), description: text('description').notNull(),
  bodyText: text('body_text').notNull(), textNodes: jsonb('text_nodes').notNull(),
}, t => [index('search_title_trgm').using('gin', t.title.op('gin_trgm_ops')), index('search_description_trgm').using('gin', t.description.op('gin_trgm_ops')), index('search_body_trgm').using('gin', t.bodyText.op('gin_trgm_ops'))]);
export const searchEpoch = pgTable('search_epoch', {
  id: integer('id').primaryKey(), version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
}, t => [check('search_epoch_id_check', sql`${t.id}=1`)]);
export const searchSessions = pgTable('search_sessions', {
  id: uuid('id').primaryKey(), identity: text('identity').notNull(), network: text('network').notNull(), requestId: uuid('request_id').notNull(),
  queryHash: text('query_hash').notNull(), queryCipher: text('query_cipher').notNull(), epoch: bigint('epoch', { mode: 'bigint' }).notNull(),
  results: jsonb('results').notNull(), metered: boolean('metered').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [unique('search_sessions_identity_request_id_key').on(t.identity,t.requestId),
  index('search_quota_identity').on(t.identity,t.createdAt).where(sql`${t.metered}`),
  index('search_quota_network').on(t.network,t.createdAt).where(sql`${t.metered}`), index('search_sessions_expiry').on(t.expiresAt)]);
