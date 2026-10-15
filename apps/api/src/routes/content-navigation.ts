import { and, asc, desc, eq, sql } from "drizzle-orm";
import { collectionItems, collections, contents, type Database } from "@yoryon/db";

/** 合集目录公开可发现，相邻作品只输出公开元数据，详情仍逐篇判断权益。 */
export async function collectionNavigation(db: Database, contentId: string) {
  const memberships = await db.select({ id: collections.id, slug: collections.slug, title: collections.title, order: collectionItems.sortOrder })
    .from(collectionItems).innerJoin(collections, eq(collectionItems.collectionId, collections.id))
    .innerJoin(contents, eq(collectionItems.contentId, contents.id))
    .where(and(eq(collectionItems.contentId, contentId), eq(contents.type, "article")));
  return Promise.all(memberships.map(async coll => {
    async function neighbor(previous: boolean) {
      const before = sql`(${collectionItems.sortOrder}, ${contents.id}) < (${coll.order}, ${contentId}::uuid)`;
      const after = sql`(${collectionItems.sortOrder}, ${contents.id}) > (${coll.order}, ${contentId}::uuid)`;
      const rows = await db.select({ id: contents.id, slug: contents.slug, title: contents.title }).from(collectionItems).innerJoin(contents, eq(contents.id, collectionItems.contentId))
        .where(and(eq(collectionItems.collectionId, coll.id), eq(contents.status, "published"), eq(contents.type, "article"), previous ? before : after))
        .orderBy(previous ? desc(collectionItems.sortOrder) : asc(collectionItems.sortOrder), previous ? desc(contents.id) : asc(contents.id)).limit(1);
      return rows[0] ?? null;
    }
    const [previous, next] = await Promise.all([neighbor(true), neighbor(false)]);
    return { id: coll.id, slug: coll.slug, title: coll.title, previous, next };
  }));
}
