import { and, eq, desc, exists, or } from "drizzle-orm";
import { cacheEvents, collections, contentMedia, contents, mediaAssets, type MediaAsset, type Database } from "@yoryon/db";
import { PUBLIC_IMAGE_MIMES } from "@yoryon/config/image-variants";

type PolicyReader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** 正文撤销与列表版本直接读取已提交的数据库状态，不依赖缓存事件送达。
 * 数据库不可用时向调用方报错，由 web 门禁失败关闭；不能回退到旧 revision。
 * 图片目录仍由签名缓存事件刷新，与正文权限门禁分开维护。
 */
export function createPublicPolicy(db: Database) {
  let images: Map<string, MediaAsset> | null = null;
  let loading: Promise<void> | null = null;
  let refreshTail = Promise.resolve();
  function refresh() {
    const operation = refreshTail.then(async () => {
      // Rebuild image exposure from one committed DB snapshot. A failed refresh
      // cannot leave the previous image policy active.
      images = null;
      const next = await db.transaction(async tx => {
        const assets = await tx.select().from(mediaAssets).where(or(
          exists(tx.select({ id: contents.id }).from(contents).where(and(eq(contents.coverMediaId, mediaAssets.id), eq(contents.status, "published")))),
          exists(tx.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, mediaAssets.id))),
          exists(tx.select({ id: contentMedia.mediaId }).from(contentMedia).innerJoin(contents, eq(contentMedia.contentId, contents.id)).where(and(eq(contentMedia.mediaId, mediaAssets.id), eq(contentMedia.exposure, "free"), eq(contents.status, "published")))),
        ));
        return { assets };
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
      images = new Map(next.assets.filter(m => PUBLIC_IMAGE_MIMES.includes(m.mimeType)).map(m => [m.id, m]));
    });
    refreshTail = operation.catch(() => {}); // 队列可恢复；调用者仍收到原操作失败。
    return operation;
  }
  return {
    refresh,
    async version(reader: PolicyReader = db) {
      // pin/unpin 与事件同事务提交；投递失败也必须使旧排序的游标过期。
      // Feed 可传入自己的 repeatable-read 事务，确保版本与分页数据来自同一快照。
      const events = await reader.select({ id: cacheEvents.id }).from(cacheEvents).orderBy(desc(cacheEvents.createdAt), desc(cacheEvents.id)).limit(1);
      return events[0]?.id ?? "00000000-0000-0000-0000-000000000000";
    },
    async get(slug: string) {
      const rows = await db.select({ revision: contents.revision }).from(contents)
        .where(and(eq(contents.slug, slug), eq(contents.status, "published"))).limit(1);
      return rows[0] ?? null;
    },
    async image(id: string) {
      if (!images) { loading ??= refresh().finally(() => { loading = null; }); await loading; }
      return images!.get(id) ?? null;
    },
  };
}
export type PublicPolicy = ReturnType<typeof createPublicPolicy>;
