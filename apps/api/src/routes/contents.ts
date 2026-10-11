/** 信息流 / 内容详情 / 合集 / 标签路由（架构 §7）。 */
import { Hono } from "hono";
import { and, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { collectionItems, collections, contents, contentMedia, contentTags, mediaAssets, tags, type Content } from "@yoryon/db";
import { canAccess, canAccessMany, truncateForPreview } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import type { AppVariables } from "../middleware/auth";

const FEED_PAGE_SIZE = 20;

/**
 * 列表查询显式投影（F07）：排除 body_markdown 全文等列表不需要的列，避免 DB→API 传输放大。
 * createdAt 保留：排序键为 coalesce(published_at, created_at)，游标编码需要。
 */
const listContentColumns = {
  id: contents.id,
  type: contents.type,
  slug: contents.slug,
  title: contents.title,
  description: contents.description,
  visibility: contents.visibility,
  coverMediaId: contents.coverMediaId,
  publishedAt: contents.publishedAt,
  createdAt: contents.createdAt,
} as const;

interface FeedCursor {
  t: Date;
  id: string;
}

function encodeCursor(t: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id }), "utf8").toString("base64url");
}

function decodeCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    // 兼容字段 k 为混排时代的遗留（feed 改为纯内容流后已不使用），解码时忽略
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t: string; id: string };
    const t = new Date(v.t);
    if (Number.isNaN(t.getTime()) || typeof v.id !== "string") return null;
    return { t, id: v.id };
  } catch {
    return null;
  }
}

/** keyset 过滤：严格匹配合并排序的全序 (sortKey desc, id desc)。 */
function keyset(cursor: FeedCursor | null, timeCol: SQL | any, idCol: any): SQL | undefined {
  if (!cursor) return undefined;
  return or(lt(timeCol, cursor.t), and(eq(timeCol, cursor.t), lt(idCol, cursor.id))) as SQL;
}

export function contentRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  /**
   * 首屏信息流：仅内容条目（合集是顶层结构，只经 /api/collections → /c 入口曝光，不混排；
   * 公开缓存；不读 session —— ADR-0003 公开线）
   *
   * 分页不变量：
   * - 排序键：coalesce(published_at, created_at) 经 date_trunc('milliseconds', ...) 截断——
   *   JS Date 与游标 ISO 编码只有毫秒精度，SQL 侧同步截断后排序/过滤/游标在同一精度上比较，
   *   微秒级写入（SQL 导入、修复脚本）不会导致跨页遗漏或重复。
   * - 全序 (sortKey desc, id desc)；多取 1 条（N+1）探测终止，无更多时 nextCursor = null。
   */
  app.get("/feed", async (c) => {
    const cursor = decodeCursor(c.req.query("cursor"));
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const rows = await deps.db
      .select(listContentColumns)
      .from(contents)
      .where(and(eq(contents.status, "published"), keyset(cursor, contentSortKey, contents.id)))
      .orderBy(desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);

    const pageIds = page.map((r) => r.id);
    const tagRows = pageIds.length
      ? await deps.db
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, pageIds))
      : [];

    const last = page[page.length - 1];
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate");
    return c.json({
      items: page.map((r) => ({
        kind: "content" as const,
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
      // 与 tags 同一终止条件：多拉 1 条才说明有下一页
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last.publishedAt ?? last.createdAt, last.id) : null,
    });
  });

  /** 内容详情：按权益返回 full | preview；no-store（ADR-0003 私有线） */
  app.get("/contents/:slug", async (c) => {
    const rows = await deps.db.select().from(contents).where(and(eq(contents.slug, c.req.param("slug")), eq(contents.status, "published"))).limit(1);
    const content = rows[0];
    if (!content) return errorResponse(c, 404, "not_found", "内容不存在");

    const auth = c.get("auth");
    // 关联查询并行化（F10a）：权益判定与 tags/media/collections 互不依赖，一个往返窗口完成
    const [fullAccess, tagRows, mediaRows, collectionRows] = await Promise.all([
      canAccess(deps.db, auth?.user ?? null, content, new Date()),
      deps.db
        .select({ slug: tags.slug, name: tags.name })
        .from(contentTags)
        .innerJoin(tags, eq(contentTags.tagId, tags.id))
        .where(eq(contentTags.contentId, content.id)),
      deps.db
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
        .orderBy(contentMedia.position),
      deps.db
        .select({ slug: collections.slug, title: collections.title })
        .from(collectionItems)
        .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
        .where(eq(collectionItems.contentId, content.id)),
    ]);

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

  /** 合集列表（公开缓存；不读 session —— 与 feed 同一公开线约定，ADR-0003）。个人站合集量级小，不分页。 */
  app.get("/collections", async (c) => {
    const rows = await deps.db.select().from(collections).orderBy(desc(collections.updatedAt));
    const itemCounts = rows.length
      ? await deps.db
          .select({ collectionId: collectionItems.collectionId, count: sql<number>`count(*)::int` })
          .from(collectionItems)
          .innerJoin(contents, eq(collectionItems.contentId, contents.id))
          .where(and(inArray(collectionItems.collectionId, rows.map((r) => r.id)), eq(contents.status, "published")))
          .groupBy(collectionItems.collectionId)
      : [];
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate");
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        visibility: r.visibility,
        coverMediaId: r.coverMediaId,
        itemCount: itemCounts.find((x) => x.collectionId === r.id)?.count ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  });

  /** 合集页：成员按 sort_order；批量权益判定（F09b，消除逐项 canAccess 的 N+1）；no-store */
  app.get("/collections/:slug", async (c) => {
    const rows = await deps.db.select().from(collections).where(eq(collections.slug, c.req.param("slug"))).limit(1);
    const collection = rows[0];
    if (!collection) return errorResponse(c, 404, "not_found", "合集不存在");

    const items = await deps.db
      .select({ ...listContentColumns, sortOrder: collectionItems.sortOrder })
      .from(collectionItems)
      .innerJoin(contents, eq(collectionItems.contentId, contents.id))
      .where(and(eq(collectionItems.collectionId, collection.id), eq(contents.status, "published")))
      .orderBy(collectionItems.sortOrder);

    const auth = c.get("auth");
    const accessMap = await canAccessMany(deps.db, auth?.user ?? null, items, new Date());
    const renderedItems = items.map((content) => ({
      slug: content.slug,
      title: content.title,
      description: content.description,
      type: content.type,
      visibility: content.visibility,
      publishedAt: content.publishedAt?.toISOString() ?? null,
      coverMediaId: content.coverMediaId,
      access: (accessMap.get(content.id) ? "full" : "preview") as "full" | "preview",
      sortOrder: content.sortOrder,
    }));

    c.header("Cache-Control", "private, no-store");
    return c.json({
      id: collection.id,
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
      .select(listContentColumns)
      .from(contentTags)
      .innerJoin(contents, eq(contentTags.contentId, contents.id))
      .where(and(eq(contentTags.tagId, tag.id), eq(contents.status, "published"), keyset(cursor, contentSortKey, contents.id)))
      .orderBy(desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const pageIds = page.map((r) => r.id);
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
      items: page.map((r) => ({
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
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last.publishedAt ?? last.createdAt, last.id) : null,
    });
  });

  return app;
}

export type { Content };
