/** 信息流 / 内容详情 / 合集 / 标签路由（架构 §7）。 */
import { Hono } from "hono";
import { and, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { collectionItems, collections, contents, contentMedia, contentTags, mediaAssets, tags, type Content } from "@yoryon/db";
import { canAccess, truncateForPreview } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import type { AppVariables } from "../middleware/auth";

const FEED_PAGE_SIZE = 20;

/** 混排条目类别（游标全序的第三级 tie-break：同 sortKey 同 id 时按 kind 字典序 desc，content 在前）。 */
type FeedKind = "content" | "collection";

interface FeedCursor {
  t: Date;
  id: string;
  k: FeedKind;
}

function encodeCursor(t: Date, id: string, k: FeedKind): string {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id, k }), "utf8").toString("base64url");
}

function decodeCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t: string; id: string; k?: string };
    const t = new Date(v.t);
    if (Number.isNaN(t.getTime()) || typeof v.id !== "string") return null;
    if (v.k !== "content" && v.k !== "collection") return null;
    return { t, id: v.id, k: v.k };
  } catch {
    return null;
  }
}

/**
 * keyset 过滤：严格匹配合并排序的全序 (sortKey desc, id desc, kind desc)。
 * kind 参与第三级比较，保证文章与合集 id 相同的极端边界下过滤与排序一致。
 */
function keyset(cursor: FeedCursor | null, timeCol: SQL | any, idCol: any, kind: FeedKind): SQL | undefined {
  if (!cursor) return undefined;
  return or(
    lt(timeCol, cursor.t),
    and(eq(timeCol, cursor.t), lt(idCol, cursor.id)),
    // 同时间同 id：本侧 kind 排在游标 kind 之后（desc）才纳入下一页
    and(eq(timeCol, cursor.t), eq(idCol, cursor.id), sql`${kind} < ${cursor.k}`),
  ) as SQL;
}

/** 混排合并排序：与 keyset 严格同一全序。 */
function compareFeedItems(a: { sortKey: Date; id: string; kind: FeedKind }, b: { sortKey: Date; id: string; kind: FeedKind }): number {
  const dt = b.sortKey.getTime() - a.sortKey.getTime();
  if (dt !== 0) return dt;
  if (a.id !== b.id) return b.id < a.id ? -1 : 1;
  return a.kind === b.kind ? 0 : a.kind === "content" ? -1 : 1;
}

export function contentRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  /**
   * 首屏信息流：内容 + 合集混排（公开缓存；不读 session —— ADR-0003 公开线）
   *
   * 分页不变量：
   * - 统一排序键：内容 = coalesce(published_at, created_at)，合集 = updated_at，
   *   全部经 date_trunc('milliseconds', ...) 截断——JS Date 与游标 ISO 编码只有毫秒精度，
   *   SQL 侧同步截断后三方（排序/过滤/游标）在同一精度上比较，微秒级写入（SQL 导入、
   *   修复脚本）不会导致跨页遗漏或重复。
   * - 全序 (sortKey desc, id desc, kind desc)：kind 编入游标，同时间同 id 跨类型不丢不重。
   * - 每侧多取 1 条（N+1）：全局前 N 必然包含于两侧前 N+1 的并集；
   *   hasMore 仅当两侧拉取总数 > N（截断后仍有剩余），无更多时 nextCursor = null。
   */
  app.get("/feed", async (c) => {
    const cursor = decodeCursor(c.req.query("cursor"));
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const collectionSortKey = sql`date_trunc('milliseconds', ${collections.updatedAt})`;
    const [contentRows, collectionRows] = await Promise.all([
      deps.db
        .select()
        .from(contents)
        .where(and(eq(contents.status, "published"), keyset(cursor, contentSortKey, contents.id, "content")))
        .orderBy(desc(contentSortKey), desc(contents.id))
        .limit(FEED_PAGE_SIZE + 1),
      deps.db
        .select()
        .from(collections)
        .where(keyset(cursor, collectionSortKey, collections.id, "collection"))
        .orderBy(desc(collectionSortKey), desc(collections.id))
        .limit(FEED_PAGE_SIZE + 1),
    ]);

    const contentIds = contentRows.map((r) => r.id);
    const tagRows = contentIds.length
      ? await deps.db
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, contentIds))
      : [];
    const itemCounts = collectionRows.length
      ? await deps.db
          .select({ collectionId: collectionItems.collectionId, count: sql<number>`count(*)::int` })
          .from(collectionItems)
          .innerJoin(contents, eq(collectionItems.contentId, contents.id))
          .where(and(inArray(collectionItems.collectionId, collectionRows.map((r) => r.id)), eq(contents.status, "published")))
          .groupBy(collectionItems.collectionId)
      : [];

    type FeedItem =
      | { kind: "content"; sortKey: Date; id: string; type: string; slug: string; title: string; description: string; visibility: string; coverMediaId: string | null; publishedAt: string | null; tags: { slug: string; name: string }[] }
      | { kind: "collection"; sortKey: Date; id: string; slug: string; title: string; description: string; visibility: string; coverMediaId: string | null; itemCount: number };

    const items: FeedItem[] = [
      ...contentRows.map((r): FeedItem => ({
        kind: "content",
        // 与 SQL contentSortKey 严格同一键
        sortKey: r.publishedAt ?? r.createdAt,
        id: r.id,
        type: r.type,
        slug: r.slug,
        title: r.title,
        description: r.description,
        visibility: r.visibility,
        coverMediaId: r.coverMediaId,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        tags: tagRows.filter((t) => t.contentId === r.id).map((t) => ({ slug: t.slug, name: t.name })),
      })),
      ...collectionRows.map((r): FeedItem => ({
        kind: "collection",
        sortKey: r.updatedAt,
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        visibility: r.visibility,
        coverMediaId: r.coverMediaId,
        itemCount: itemCounts.find((x) => x.collectionId === r.id)?.count ?? 0,
      })),
    ]
      .sort(compareFeedItems)
      .slice(0, FEED_PAGE_SIZE);

    // 终止条件：两侧拉取总数超过页大小（即截断后仍有剩余）才有下一页
    const hasMore = contentRows.length + collectionRows.length > FEED_PAGE_SIZE;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.sortKey, last.id, last.kind) : null;
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate");
    return c.json({ items: items.map(({ sortKey: _sk, ...rest }) => rest), nextCursor });
  });

  /** 内容详情：按权益返回 full | preview；no-store（ADR-0003 私有线） */
  app.get("/contents/:slug", async (c) => {
    const rows = await deps.db.select().from(contents).where(and(eq(contents.slug, c.req.param("slug")), eq(contents.status, "published"))).limit(1);
    const content = rows[0];
    if (!content) return errorResponse(c, 404, "not_found", "内容不存在");

    const auth = c.get("auth");
    const fullAccess = await canAccess(deps.db, auth?.user ?? null, content, new Date());

    const tagRows = await deps.db
      .select({ slug: tags.slug, name: tags.name })
      .from(contentTags)
      .innerJoin(tags, eq(contentTags.tagId, tags.id))
      .where(eq(contentTags.contentId, content.id));

    const mediaRows = await deps.db
      .select({
        mediaId: contentMedia.mediaId,
        position: contentMedia.position,
        exposure: contentMedia.exposure,
        mimeType: mediaAssets.mimeType,
        width: mediaAssets.width,
        height: mediaAssets.height,
        durationSec: mediaAssets.durationSec,
      })
      .from(contentMedia)
      .innerJoin(mediaAssets, eq(contentMedia.mediaId, mediaAssets.id))
      .where(eq(contentMedia.contentId, content.id))
      .orderBy(contentMedia.position);

    const collectionRows = await deps.db
      .select({ slug: collections.slug, title: collections.title })
      .from(collectionItems)
      .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
      .where(eq(collectionItems.contentId, content.id));

    let bodyMarkdown: string;
    let access: "full" | "preview";
    let hasPaidContent = false;
    if (fullAccess) {
      bodyMarkdown = content.bodyMarkdown;
      access = "full";
    } else {
      const preview = truncateForPreview(content.bodyMarkdown, content.previewMode, content.previewPercent, {
        mediaBlockWeight: deps.env.MEDIA_BLOCK_WEIGHT,
      });
      bodyMarkdown = preview.freeMarkdown;
      access = "preview";
      hasPaidContent = preview.hasPaidContent || content.visibility === "paid";
    }

    // 未授权响应不包含付费正文与付费媒体引用（ADR-0004）
    const visibleMedia = mediaRows.filter((m) => fullAccess || m.exposure === "free");

    c.header("Cache-Control", "private, no-store");
    return c.json({
      id: content.id,
      type: content.type,
      slug: content.slug,
      title: content.title,
      description: content.description,
      visibility: content.visibility,
      publishedAt: content.publishedAt?.toISOString() ?? null,
      access,
      hasPaidContent,
      bodyMarkdown,
      coverMediaId: content.coverMediaId,
      tags: tagRows,
      collections: collectionRows,
      media: visibleMedia,
    });
  });

  /** 合集页：成员按 sort_order；逐项权益裁剪（no-store） */
  app.get("/collections/:slug", async (c) => {
    const rows = await deps.db.select().from(collections).where(eq(collections.slug, c.req.param("slug"))).limit(1);
    const collection = rows[0];
    if (!collection) return errorResponse(c, 404, "not_found", "合集不存在");

    const items = await deps.db
      .select({ content: contents, sortOrder: collectionItems.sortOrder })
      .from(collectionItems)
      .innerJoin(contents, eq(collectionItems.contentId, contents.id))
      .where(and(eq(collectionItems.collectionId, collection.id), eq(contents.status, "published")))
      .orderBy(collectionItems.sortOrder);

    const auth = c.get("auth");
    const now = new Date();
    const renderedItems = [] as {
      slug: string; title: string; description: string; type: string; visibility: string;
      publishedAt: string | null; coverMediaId: string | null; access: "full" | "preview"; sortOrder: number;
    }[];
    for (const { content, sortOrder } of items) {
      const ok = await canAccess(deps.db, auth?.user ?? null, content, now);
      renderedItems.push({
        slug: content.slug,
        title: content.title,
        description: content.description,
        type: content.type,
        visibility: content.visibility,
        publishedAt: content.publishedAt?.toISOString() ?? null,
        coverMediaId: content.coverMediaId,
        access: ok ? "full" : "preview",
        sortOrder,
      });
    }

    c.header("Cache-Control", "private, no-store");
    return c.json({
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      visibility: collection.visibility,
      coverMediaId: collection.coverMediaId,
      items: renderedItems,
    });
  });

  /** 标签筛选（公开缓存）；items 与 feed 的内容项同一合同（含 tags），供 LoadMore 直接渲染 */
  app.get("/tags/:slug", async (c) => {
    const tagRows = await deps.db.select().from(tags).where(eq(tags.slug, c.req.param("slug"))).limit(1);
    const tag = tagRows[0];
    if (!tag) return errorResponse(c, 404, "not_found", "标签不存在");
    const cursor = decodeCursor(c.req.query("cursor"));
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const rows = await deps.db
      .select({ content: contents })
      .from(contentTags)
      .innerJoin(contents, eq(contentTags.contentId, contents.id))
      .where(and(eq(contentTags.tagId, tag.id), eq(contents.status, "published"), keyset(cursor, contentSortKey, contents.id, "content")))
      .orderBy(desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const pageIds = page.map((r) => r.content.id);
    const pageTagRows = pageIds.length
      ? await deps.db
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, pageIds))
      : [];
    const last = page[page.length - 1];
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate");
    return c.json({
      tag: { slug: tag.slug, name: tag.name },
      items: page.map(({ content: r }) => ({
        kind: "content" as const,
        id: r.id,
        type: r.type,
        slug: r.slug,
        title: r.title,
        description: r.description,
        visibility: r.visibility,
        coverMediaId: r.coverMediaId,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        tags: pageTagRows.filter((t) => t.contentId === r.id).map((t) => ({ slug: t.slug, name: t.name })),
      })),
      // 与 feed 同一终止条件：多拉 1 条才说明有下一页
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last.content.publishedAt ?? last.content.createdAt, last.content.id, "content") : null,
    });
  });

  return app;
}

export type { Content };
