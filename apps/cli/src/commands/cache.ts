import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import { cacheEvents, contents } from "@yoryon/db";
import { eq } from "drizzle-orm";
import { acquirePublishGcLock, associations, contentTargets, deliverCacheEvents, enqueueCacheEvent } from "@yoryon/core";
import { withCacheTransaction } from "../cache";
import { closeContext, getContext, withLockClient } from "../context";

export function registerCacheCommands(program: Command) {
  const cache = program.command("cache").description("发布缓存验收与恢复");
  cache
    .command("refresh")
    .argument("<slug>")
    .description("SQL 数据修复后刷新当前内容及全部关联公开页面（同事务轮换 revision，旧渲染版本立即失效）")
    .action(async (slug: string) => {
      try {
        await withCacheTransaction(async tx => {
          const rows = await tx.select({ id: contents.id }).from(contents).where(eq(contents.slug, slug));
          if (!rows[0]) throw new Error(`内容不存在: ${slug}`);
          const related = await associations(tx, rows[0].id);
          // 原子轮换 revision + updated_at，再入队缓存事件：web 门禁以 contents.revision 校验 /render/<revision>/<slug>，
          // 不轮换则失效后完成的旧渲染可能以同一 revision 重填缓存，绕过 SQL 修复后的权限收紧。
          // 注意：缓存事件 payload 的 revision 字段是变更时间（ISO 时间戳语义），与 contents.revision（UUID 版本键）不同。
          const now = new Date();
          await tx.update(contents).set({ revision: randomUUID(), updatedAt: now }).where(eq(contents.id, rows[0].id));
          await enqueueCacheEvent(tx, contentTargets(slug, related.tags, related.collections), slug, now.toISOString());
        });
        console.log(`✓ ${slug} revision rotated; page state is reported by cache event above`);
      } finally {
        await closeContext();
      }
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
