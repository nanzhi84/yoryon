import { eq, inArray } from "drizzle-orm";
import { collections, contents } from "@yoryon/db";
import { associations, contentTargets, deliverCacheEvents, enqueueCacheEvent, acquirePublishGcLock, invalidateReferrers } from "@yoryon/core";
import { getContext, withLockClient } from "./context";

type Tx = Parameters<Parameters<ReturnType<typeof getContext>["db"]["transaction"]>[0]>[0];
export async function withCacheTransaction<T>(operation: (tx: Tx) => Promise<T>) {
  const ctx = getContext();
  return withLockClient(async client => {
    const lock = await acquirePublishGcLock(client, { blocking: true });
    try {
      const result = await ctx.db.transaction(operation);
      await deliverCacheEvents(ctx.db, { logger: console.log });
      return result;
    } finally { await lock.release(); }
  });
}

export async function mutateContent(slug: string, remove: boolean) {
  const ctx = getContext();
  await withLockClient(async client => {
    const lock = await acquirePublishGcLock(client, { blocking: true });
    try {
      await ctx.db.transaction(async tx => {
        const rows = await tx.select({ id: contents.id }).from(contents).where(eq(contents.slug, slug));
        if (!rows[0]) throw new Error(`内容不存在: ${slug}`);
        const old = await associations(tx, rows[0].id);
        await invalidateReferrers(tx, rows[0].id);
        if (remove) await tx.delete(contents).where(eq(contents.slug, slug));
        else await tx.update(contents).set({ status: "draft", updatedAt: new Date() }).where(eq(contents.slug, slug));
        if (old.collections.length) await tx.update(collections).set({ updatedAt: new Date() }).where(inArray(collections.slug, old.collections));
        await enqueueCacheEvent(tx, contentTargets(slug, old.tags, old.collections), slug);
      });
      await deliverCacheEvents(ctx.db, { logger: console.log });
    } finally { await lock.release(); }
  });
}
