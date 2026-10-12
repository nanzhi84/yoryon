import { and, eq, desc, exists, or } from "drizzle-orm";
import { cacheEvents, collections, contentMedia, contents, mediaAssets, type MediaAsset, type Database } from "@yoryon/db";
import { PUBLIC_IMAGE_MIMES } from "@yoryon/config/image-variants";

/** 单 API 进程的撤销门禁。请求只读内存；业务发布同步刷新后才报告生效。
 * 重启首次请求从数据库重建，失败不返回旧状态。扩展多实例前必须改为共享强一致存储。
 */
export function createPublicPolicy(db: Database) {
  let snapshot: Map<string, { revision: string }> | null = null;
  let images: Map<string, MediaAsset> | null = null;
  let epoch = "00000000-0000-0000-0000-000000000000";
  let loading: Promise<void> | null = null;
  let refreshTail = Promise.resolve();
  function refresh() {
    const operation = refreshTail.then(async () => {
      // Publish and image exposure come from one committed DB snapshot. If refresh
      // fails, future requests must rebuild rather than use a revoked policy.
      snapshot = null; images = null;
      const next = await db.transaction(async tx => {
        const rows = await tx.select({ slug: contents.slug, revision: contents.revision }).from(contents).where(eq(contents.status, "published"));
        const events = await tx.select({ id: cacheEvents.id }).from(cacheEvents).orderBy(desc(cacheEvents.createdAt), desc(cacheEvents.id)).limit(1);
        const assets = await tx.select().from(mediaAssets).where(or(
          exists(tx.select({ id: contents.id }).from(contents).where(and(eq(contents.coverMediaId, mediaAssets.id), eq(contents.status, "published")))),
          exists(tx.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, mediaAssets.id))),
          exists(tx.select({ id: contentMedia.mediaId }).from(contentMedia).innerJoin(contents, eq(contentMedia.contentId, contents.id)).where(and(eq(contentMedia.mediaId, mediaAssets.id), eq(contentMedia.exposure, "free"), eq(contents.status, "published")))),
        ));
        return { rows, events, assets };
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
      snapshot = new Map(next.rows.map(row => [row.slug, { revision: row.revision }]));
      images = new Map(next.assets.filter(m => PUBLIC_IMAGE_MIMES.includes(m.mimeType)).map(m => [m.id, m]));
      epoch = next.events[0]?.id ?? "00000000-0000-0000-0000-000000000000";
    });
    refreshTail = operation.catch(() => {}); // 队列可恢复；调用者仍收到原操作失败。
    return operation;
  }
  return {
    refresh,
    async version() {
      if (!snapshot) { loading ??= refresh().finally(() => { loading = null; }); await loading; }
      return epoch;
    },
    async get(slug: string) {
      if (!snapshot) {
        loading ??= refresh().finally(() => { loading = null; });
        await loading;
      }
      return snapshot!.get(slug) ?? null;
    },
    async image(id: string) {
      if (!snapshot) { loading ??= refresh().finally(() => { loading = null; }); await loading; }
      return images!.get(id) ?? null;
    },
  };
}
export type PublicPolicy = ReturnType<typeof createPublicPolicy>;
