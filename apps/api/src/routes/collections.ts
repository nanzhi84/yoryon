import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { collectionItems, collections, contents, mediaAssets } from "@yoryon/db";
import { canAccessMany } from "@yoryon/core";
import type { AppDeps } from "../deps";
import type { PublicPolicy } from "../public-policy";
import type { AppVariables } from "../middleware/auth";
import { errorResponse } from "../errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const collectionColumns = { id: collections.id, slug: collections.slug, title: collections.title, description: collections.description,
  visibility: collections.visibility, coverMediaId: collections.coverMediaId, isPinned: collections.isPinned, updatedAt: collections.updatedAt };
const coverColumns = { id: mediaAssets.id, mimeType: mediaAssets.mimeType, width: mediaAssets.width, height: mediaAssets.height };
const chapterColumns = { id: contents.id, slug: contents.slug, title: contents.title, description: contents.description,
  type: contents.type, visibility: contents.visibility, publishedAt: contents.publishedAt, coverMediaId: contents.coverMediaId,
  sortOrder: collectionItems.sortOrder };
const snapshot = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

export function collectionRoutes(deps: AppDeps, policy: PublicPolicy) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get("/collections", async c => deps.db.transaction(async tx => {
    const version = await policy.version(tx);
    const rows = await tx.select({ ...collectionColumns, cover: coverColumns }).from(collections)
      .leftJoin(mediaAssets, eq(collections.coverMediaId, mediaAssets.id))
      .orderBy(desc(collections.isPinned), desc(collections.updatedAt), asc(collections.id));
    const counts = rows.length ? await tx.select({ collectionId: collectionItems.collectionId, count: sql<number>`count(*)::int` })
      .from(collectionItems).innerJoin(contents, eq(contents.id, collectionItems.contentId))
      .where(and(inArray(collectionItems.collectionId, rows.map(row => row.id)), eq(contents.status, "published"))).groupBy(collectionItems.collectionId) : [];
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({ version, items: rows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString(),
      itemCount: counts.find(count => count.collectionId === row.id)?.count ?? 0 })) });
  }, snapshot));

  /** The directory is discoverable; per-work rights remain private and are never inferred from collection visibility. */
  app.get("/collections/:slug", async c => deps.db.transaction(async tx => {
    c.header("Cache-Control", "private, no-store");
    const [collection] = await tx.select({ ...collectionColumns, cover: coverColumns }).from(collections)
      .leftJoin(mediaAssets, eq(collections.coverMediaId, mediaAssets.id)).where(eq(collections.slug, c.req.param("slug"))).limit(1);
    if (!collection) return errorResponse(c, 404, "not_found", "合集不存在");
    const items = await tx.select(chapterColumns).from(collectionItems).innerJoin(contents, eq(contents.id, collectionItems.contentId))
      .where(and(eq(collectionItems.collectionId, collection.id), eq(contents.status, "published")))
      .orderBy(asc(collectionItems.sortOrder), asc(contents.id));
    const rights = await canAccessMany(tx, c.get("auth")?.user ?? null, items, new Date());
    return c.json({ ...collection, updatedAt: collection.updatedAt.toISOString(), items: items.map(item => ({ ...item,
      publishedAt: item.publishedAt?.toISOString() ?? null, access: rights.get(item.id) ? "full" as const : "preview" as const })) });
  }, snapshot));

  /** Collection context only validates attribution and navigation. It never grants chapter access or returns body/media URLs. */
  app.get("/collections/:slug/chapters/:contentId", async c => deps.db.transaction(async tx => {
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    if (!UUID.test(c.req.param("contentId"))) return errorResponse(c, 404, "not_found", "章节不属于该合集");
    const [collection] = await tx.select({ id: collections.id, slug: collections.slug, title: collections.title }).from(collections)
      .where(eq(collections.slug, c.req.param("slug"))).limit(1);
    if (!collection) return errorResponse(c, 404, "not_found", "合集不存在");
    const rows = await tx.select({ id: contents.id, slug: contents.slug, title: contents.title, visibility: contents.visibility,
      publishedAt: contents.publishedAt, sortOrder: collectionItems.sortOrder }).from(collectionItems)
      .innerJoin(contents, eq(contents.id, collectionItems.contentId))
      .where(and(eq(collectionItems.collectionId, collection.id), eq(contents.status, "published")))
      .orderBy(asc(collectionItems.sortOrder), asc(contents.id));
    const items = rows.map(row => ({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null }));
    const index = items.findIndex(item => item.id === c.req.param("contentId").toLowerCase());
    if (index < 0) return errorResponse(c, 404, "not_found", "章节不属于该合集");
    return c.json({ collection, chapter: items[index]!, previous: items[index - 1] ?? null, next: items[index + 1] ?? null });
  }, snapshot));
  return app;
}
