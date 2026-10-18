import path from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { collections, type Database } from "@yoryon/db";
import * as schema from "@yoryon/db/schema";
import { acquirePublishGcLock } from "./locks";
import { deliverCacheEvents, enqueueCacheEvent } from "./cache-events";
import { mimeForFile, type PublishDeps } from "./publish";
import { prepareLocalMedia, uploadPreparedMedia, upsertPreparedMedia } from "./media-upload";

/** Upload first, atomically swap the cover association second; old assets stay under the shared GC policy. */
export async function setCollectionCover(deps: PublishDeps, slug: string, filename: string | null) {
  const lock = await acquirePublishGcLock(deps.lockClient, { blocking: true });
  const db = drizzle(deps.lockClient, { schema }) as unknown as Database;
  const log = deps.logger ?? (() => {});
  try {
    const [collection] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
    if (!collection) throw new Error(`合集不存在: ${slug}`);
    const media = filename ? await prepareLocalMedia(path.resolve(filename), mimeForFile(filename)) : null;
    if (media && (!media.mime.startsWith("image/") || !media.dims)) throw new Error("合集封面必须是可识别的图片文件");
    if (media) log(`cover ${await uploadPreparedMedia(deps.storage, media)}`);
    const mediaId = await db.transaction(async tx => {
      await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, collection.id)).for("update");
      const id = media ? await upsertPreparedMedia(tx, media) : null;
      await tx.update(collections).set({ coverMediaId: id, updatedAt: new Date() }).where(eq(collections.id, collection.id));
      await enqueueCacheEvent(tx, { tags: ["collections", "member-feed", "sitemap", `collection:${slug}`], paths: ["/c", `/c/${slug}`, "/sitemap.xml"] });
      return id;
    });
    await deliverCacheEvents(db, { logger: log });
    return { collectionId: collection.id, mediaId };
  } finally { await lock.release(); }
}
