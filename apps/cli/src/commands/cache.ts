import type { Command } from "commander";
import { cacheEvents, contents } from "@yoryon/db";
import { eq } from "drizzle-orm";
import { acquirePublishGcLock, associations, contentTargets, deliverCacheEvents, enqueueCacheEvent } from "@yoryon/core";
import { withCacheTransaction } from "../cache";
import { closeContext, getContext, withLockClient } from "../context";

export function registerCacheCommands(program: Command) {
  const cache = program.command("cache").description("发布缓存验收与恢复");
  cache.command("refresh").argument("<slug>").description("SQL 数据修复后刷新当前内容及全部关联公开页面").action(async (slug: string) => {
    try {
      await withCacheTransaction(async tx => {
        const rows = await tx.select({ id: contents.id, updatedAt: contents.updatedAt }).from(contents).where(eq(contents.slug, slug));
        if (!rows[0]) throw new Error(`内容不存在: ${slug}`);
        const related = await associations(tx, rows[0].id);
        await enqueueCacheEvent(tx, contentTargets(slug, related.tags, related.collections), slug, rows[0].updatedAt.toISOString());
      });
    } finally { await closeContext(); }
  });
  cache.command("status").action(async () => {
    const ctx = getContext();
    try {
      const rows = await ctx.db.select({ id: cacheEvents.id, state: cacheEvents.state, attempts: cacheEvents.attempts, lastError: cacheEvents.lastError }).from(cacheEvents).orderBy(cacheEvents.createdAt);
      for (const row of rows) console.log(JSON.stringify(row));
    } finally { await closeContext(); }
  });
  cache.command("retry").description("串行恢复最多 100 个未验收事件，每事件最多 3 次尝试").action(async () => {
    const ctx = getContext();
    try {
      await withLockClient(async client => {
        const lock = await acquirePublishGcLock(client, { blocking: true });
        try { await deliverCacheEvents(ctx.db, { retry: true, logger: console.log }); }
        finally { await lock.release(); }
      });
    } finally { await closeContext(); }
  });
}
