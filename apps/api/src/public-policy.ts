import { and, eq, exists, or } from "drizzle-orm";
import { cacheEvents, catalogVersions, collections, contentMedia, contents, mediaAssets, type Database } from "@yoryon/db";
import { PUBLIC_IMAGE_MIMES } from "@yoryon/config/image-variants";

import type { CatalogScope } from "@yoryon/config/cache";

type PolicyReader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** 正文撤销与列表版本直接读取已提交的数据库状态，不依赖缓存事件送达。
 * 数据库不可用时向调用方报错，由 web 门禁失败关闭；不能回退到旧 revision。
 * 图片同样在缓存字节之前实时检查公开曝光，投递失败不得延迟撤销。
 */
export function createPublicPolicy(db: Database) {
  // 所有门禁实时读数据库；失效事件仅负责 web 数据缓存和预热，不承担授权。
  async function refresh() {
    await db.select({ id: cacheEvents.id }).from(cacheEvents).limit(1);
  }
  return {
    refresh,
    async version(scope: CatalogScope, reader: PolicyReader = db) {
      const [current] = await reader.select({ version: catalogVersions.version }).from(catalogVersions)
        .where(eq(catalogVersions.scope, scope)).limit(1);
      return current?.version ?? "00000000-0000-0000-0000-000000000000";
    },
    async get(slug: string) {
      const rows = await db.select({ revision: contents.revision }).from(contents)
        .where(and(eq(contents.slug, slug), eq(contents.status, "published"))).limit(1);
      return rows[0] ?? null;
    },
    async image(id: string) {
      const [image] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), or(
        exists(db.select({ id: contents.id }).from(contents).where(and(eq(contents.coverMediaId, mediaAssets.id), eq(contents.status, "published")))),
        exists(db.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, mediaAssets.id))),
        exists(db.select({ id: contentMedia.mediaId }).from(contentMedia).innerJoin(contents, eq(contentMedia.contentId, contents.id))
          .where(and(eq(contentMedia.mediaId, mediaAssets.id), eq(contentMedia.exposure, "free"), eq(contents.status, "published")))),
      ))).limit(1);
      return image && PUBLIC_IMAGE_MIMES.includes(image.mimeType) ? image : null;
    },
  };
}
export type PublicPolicy = ReturnType<typeof createPublicPolicy>;
