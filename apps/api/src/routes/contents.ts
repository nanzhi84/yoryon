/** 信息流 / 内容详情 / 合集 / 标签路由（架构 §7）。 */
import { Hono } from "hono";
import { and, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { collectionItems, collections, contents, contentMedia, contentTags, mediaAssets, tags, type Content } from "@yoryon/db";
import { canAccess, canAccessMany, truncateForPreview } from "@yoryon/core";
import { loadContentDetail } from "./content-detail";
import type { PublicPolicy } from "../public-policy";
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
  isPinned: contents.isPinned,
} as const;

interface FeedCursor {
  p: boolean;
  t: Date;
  id: string;
}

/** feed 游标：完整三元组 (isPinned, 毫秒 sortKey, id)。置顶变更会推进版本使旧游标 409；残留旧格式在此拒绝而非静默回首页。 */
function encodeCursor(p: boolean, t: Date, id: string): string {
  return Buffer.from(JSON.stringify({ p, t: t.toISOString(), id }), "utf8").toString("base64url");
}

function decodeCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { p?: unknown; t: string; id: string };
    const t = new Date(v.t);
    if (typeof v.p !== "boolean" || Number.isNaN(t.getTime()) || typeof v.id !== "string") return null;
    return { p: v.p, t, id: v.id };
  } catch {
    return null;
  }
}

/** 标签页游标：维持既有二元格式 {t,id}（标签排序与置顶无关，新旧游标均可解码）。 */
function encodeTagCursor(t: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id }), "utf8").toString("base64url");
}

function decodeTagCursor(raw: string | undefined): { t: Date; id: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t: string; id: string };
    const t = new Date(v.t);
    if (Number.isNaN(t.getTime()) || typeof v.id !== "string") return null;
    return { t, id: v.id };
  } catch {
    return null;
  }
}

/** keyset 过滤：严格匹配合并排序的全序 (isPinned desc, sortKey desc, id desc)。 */
function keyset(cursor: FeedCursor | null, pinnedCol: any, timeCol: SQL | any, idCol: any): SQL | undefined {
  if (!cursor) return undefined;
  return or(
    lt(pinnedCol, cursor.p),
    and(eq(pinnedCol, cursor.p), lt(timeCol, cursor.t)),
    and(eq(pinnedCol, cursor.p), eq(timeCol, cursor.t), lt(idCol, cursor.id)),
  ) as SQL;
}

export function contentRoutes(deps: AppDeps, policy: PublicPolicy) {
  const app = new Hono<{ Variables: AppVariables }>();

  /**
   * 首屏信息流：仅免费内容条目（Issue #15：首页=免费时间线；付费条目经 /api/paid-feed 在订阅页曝光；
   * 合集是顶层结构，只经 /api/collections → /c 入口曝光，不混排；公开缓存；不读 session —— ADR-0003 公开线）
   *
   * 分页不变量：
   * - 排序键：is_pinned desc，再 coalesce(published_at, created_at) 经 date_trunc('milliseconds', ...) 截断——
   *   JS Date 与游标 ISO 编码只有毫秒精度，SQL 侧同步截断后排序/过滤/游标在同一精度上比较，
   *   微秒级写入（SQL 导入、修复脚本）不会导致跨页遗漏或重复。
   * - 全序 (isPinned desc, sortKey desc, id desc)；游标编码同一三元组，跨置顶边界不重复/不漏项；
   *   多取 1 条（N+1）探测终止，无更多时 nextCursor = null。
   */
  app.get("/feed", async (c) => deps.db.transaction(async (tx) => {
    const version = await policy.version(tx);
    if (c.req.query("version") && c.req.query("version") !== version) return errorResponse(c, 409, "snapshot_expired", "列表已更新，请刷新页面");
    const rawCursor = c.req.query("cursor");
    const cursor = decodeCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效，请刷新列表");
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const rows = await tx
      .select(listContentColumns)
      .from(contents)
      .where(and(eq(contents.status, "published"), eq(contents.visibility, "public"), keyset(cursor, contents.isPinned, contentSortKey, contents.id)))
      .orderBy(desc(contents.isPinned), desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);

    const pageIds = page.map((r) => r.id);
    const tagRows = pageIds.length
      ? await tx
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, pageIds))
      : [];

    const last = page[page.length - 1];
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({
      version,
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
        isPinned: r.isPinned,
        tags: tagRows.filter((t) => t.contentId === r.id).map((t) => ({ slug: t.slug, name: t.name })),
      })),
      // 与 tags 同一终止条件：多拉 1 条才说明有下一页
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last.isPinned, last.publishedAt ?? last.createdAt, last.id) : null,
    });
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));

  /**
   * 付费内容列表（Issue #15 订阅页“付费内容”区）：与 /api/feed 对称的公开线端点。
   * 只出元数据（标题/摘要/时间/封面）——正文访问仍由 /api/contents/:slug 逐篇判定权益；
   * 排序无置顶（置顶是首页概念），二元游标 (sortKey, id)。
   */
  app.get("/paid-feed", async (c) => deps.db.transaction(async tx => {
    const version = await policy.version(tx);
    if (c.req.query("version") && c.req.query("version") !== version) return errorResponse(c, 409, "snapshot_expired", "列表已更新，请刷新页面");
    const rawCursor = c.req.query("cursor");
    const cursor = decodeTagCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效，请刷新列表");
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const conds = [eq(contents.status, "published"), eq(contents.visibility, "paid")];
    if (cursor) {
      conds.push(
        or(
          lt(contentSortKey, cursor.t),
          and(sql`${contentSortKey} = ${cursor.t.toISOString()}::timestamptz`, lt(contents.id, cursor.id)),
        )!,
      );
    }
    const rows = await tx
      .select(listContentColumns)
      .from(contents)
      .where(and(...conds))
      .orderBy(desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const pageIds = page.map((r) => r.id);
    const tagRows = pageIds.length
      ? await tx
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, pageIds))
      : [];
    const last = page[page.length - 1];
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({
      version,
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
        isPinned: r.isPinned,
        tags: tagRows.filter((t) => t.contentId === r.id).map((t) => ({ slug: t.slug, name: t.name })),
      })),
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeTagCursor(last.publishedAt ?? last.createdAt, last.id) : null,
    });
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));

  /** 标签总览（公开线；探索页用）：含已发布内容数，按数量降序。 */
  app.get("/tags", async (c) => {
    const rows = await deps.db
      .select({ slug: tags.slug, name: tags.name, count: sql<number>`count(${contents.id})::int` })
      .from(tags)
      .leftJoin(contentTags, eq(contentTags.tagId, tags.id))
      .leftJoin(contents, and(eq(contents.id, contentTags.contentId), eq(contents.status, "published")))
      .groupBy(tags.id, tags.slug, tags.name)
      .orderBy(desc(sql`count(${contents.id})`), tags.slug);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({ tags: rows });
  });

  app.get("/contents/:slug", async c => {
    c.header("Cache-Control", "private, no-store");
    const data = await loadContentDetail(deps, c.req.param("slug"), c.get("auth")?.user ?? null);
    return data ? c.json(data) : errorResponse(c, 404, "not_found", "内容不存在");
  });
  app.get("/public/contents/:slug", async c => {
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    const data = await loadContentDetail(deps, c.req.param("slug"), null);
    return data ? c.json(data) : errorResponse(c, 404, "not_found", "内容不存在");
  });

  /** 合集列表（公开缓存；不读 session —— 与 feed 同一公开线约定，ADR-0003）。个人站合集量级小，不分页。 */
  app.get("/collections", async (c) => {
    const version = await policy.version();
    const rows = await deps.db.select().from(collections).orderBy(desc(collections.updatedAt));
    const itemCounts = rows.length
      ? await deps.db
          .select({ collectionId: collectionItems.collectionId, count: sql<number>`count(*)::int` })
          .from(collectionItems)
          .innerJoin(contents, eq(collectionItems.contentId, contents.id))
          .where(and(inArray(collectionItems.collectionId, rows.map((r) => r.id)), eq(contents.status, "published")))
          .groupBy(collectionItems.collectionId)
      : [];
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({
      version,
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

  /** 标签页 keyset：仅 (sortKey desc, id desc)，不受置顶影响（标签页维持现有行为）。 */
function tagKeyset(cursor: { t: Date; id: string } | null, timeCol: SQL | any, idCol: any): SQL | undefined {
  if (!cursor) return undefined;
  return or(lt(timeCol, cursor.t), and(eq(timeCol, cursor.t), lt(idCol, cursor.id))) as SQL;
}

/** 标签筛选（公开缓存）；items 与 feed 的内容项同一合同（含 tags），供 LoadMore 直接渲染 */
  app.get("/tags/:slug", async (c) => deps.db.transaction(async (tx) => {
    const version = await policy.version(tx);
    if (c.req.query("version") && c.req.query("version") !== version) return errorResponse(c, 409, "snapshot_expired", "列表已更新，请刷新页面");
    const tagRows = await tx.select().from(tags).where(eq(tags.slug, c.req.param("slug"))).limit(1);
    const tag = tagRows[0];
    if (!tag) return errorResponse(c, 404, "not_found", "标签不存在");
    const rawCursor = c.req.query("cursor");
    const cursor = decodeTagCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效，请刷新列表");
    const contentSortKey = sql`date_trunc('milliseconds', coalesce(${contents.publishedAt}, ${contents.createdAt}))`;
    const rows = await tx
      .select(listContentColumns)
      .from(contentTags)
      .innerJoin(contents, eq(contentTags.contentId, contents.id))
      .where(and(eq(contentTags.tagId, tag.id), eq(contents.status, "published"), tagKeyset(cursor, contentSortKey, contents.id)))
      .orderBy(desc(contentSortKey), desc(contents.id))
      .limit(FEED_PAGE_SIZE + 1);
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const pageIds = page.map((r) => r.id);
    const pageTagRows = pageIds.length
      ? await tx
          .select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
          .from(contentTags)
          .innerJoin(tags, eq(contentTags.tagId, tags.id))
          .where(inArray(contentTags.contentId, pageIds))
      : [];
    const last = page[page.length - 1];
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({
      tag: { slug: tag.slug, name: tag.name },
      version,
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
        isPinned: r.isPinned,
        tags: pageTagRows.filter((t) => t.contentId === r.id).map((t) => ({ slug: t.slug, name: t.name })),
      })),
      // 与 feed 同一终止条件：多拉 1 条才说明有下一页；标签游标维持二元格式（排序与置顶无关）
      nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeTagCursor(last.publishedAt ?? last.createdAt, last.id) : null,
    });
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));

  return app;
}

export type { Content };
