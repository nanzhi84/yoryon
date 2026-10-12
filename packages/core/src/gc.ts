/**
 * 媒体垃圾回收（ADR-0006，架构 §6.5）——packages/core 唯一实现，CLI 调用。
 *
 * - GC 使用与发布同一把 advisory lock，pg_try_advisory_lock 非阻塞获取，失败即跳过本轮；
 * - 扫描、引用复核、实际删除期间持续持锁；
 * - 清理对象 ①：OSS 有对象但 DB 无 media_assets 记录且年龄 > 24h（孤儿）；
 * - 清理对象 ②：media_assets 零引用（无 content_media 边、非任何封面）且超过 7 天宽限期；
 * - 删除前复核引用计数为零；默认 dry-run，--apply 才执行删除。
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { collections, contentMedia, contents, mediaAssets, users, type Database } from "@yoryon/db";
import { GC_ORPHAN_GRACE_MS, GC_ZERO_REF_GRACE_MS, MEDIA_KEY_PREFIX } from "@yoryon/config";
import type { MediaStorage } from "./storage";
import { acquirePublishGcLock, GcLockUnavailableError } from "./locks";
import type pg from "pg";

export interface GcDeps {
  lockClient: pg.Client;
  db: Database;
  storage: MediaStorage;
  now?: Date;
  logger?: (msg: string) => void;
}

export interface GcReport {
  skipped: boolean;
  dryRun: boolean;
  orphans: { key: string; size: number; lastModified: Date }[];
  zeroRefAssets: { id: string; ossKey: string }[];
  deletedObjects: number;
  deletedRows: number;
  errors: string[];
}

export async function runMediaGc(deps: GcDeps, opts: { apply: boolean }): Promise<GcReport> {
  const log = deps.logger ?? (() => {});
  const now = deps.now ?? new Date();
  const report: GcReport = {
    skipped: false,
    dryRun: !opts.apply,
    orphans: [],
    zeroRefAssets: [],
    deletedObjects: 0,
    deletedRows: 0,
    errors: [],
  };

  let lock;
  try {
    lock = await acquirePublishGcLock(deps.lockClient, { blocking: false });
  } catch (err) {
    if (err instanceof GcLockUnavailableError) {
      log("another publish holds the media lock; skipping this GC round");
      report.skipped = true;
      return report;
    }
    throw err;
  }

  try {
    // ---- 清理对象 ②：零引用 media_assets（7 天宽限期） ----
    const zeroRefBefore = new Date(now.getTime() - GC_ZERO_REF_GRACE_MS);
    const candidates = await deps.db
      .select({ id: mediaAssets.id, ossKey: mediaAssets.ossKey })
      .from(mediaAssets)
      .where(lt(mediaAssets.createdAt, zeroRefBefore));

    for (const asset of candidates) {
      const edges = await deps.db.select({ contentId: contentMedia.contentId }).from(contentMedia).where(eq(contentMedia.mediaId, asset.id)).limit(1);
      const contentCovers = await deps.db.select({ id: contents.id }).from(contents).where(eq(contents.coverMediaId, asset.id)).limit(1);
      const collectionCovers = await deps.db.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, asset.id)).limit(1);
      const avatars = await deps.db.select({ id: users.id }).from(users).where(eq(users.avatarMediaId, asset.id)).limit(1);
      const refCount = edges.length + contentCovers.length + collectionCovers.length + avatars.length;
      if (refCount > 0) continue; // 删除前复核引用计数为零
      report.zeroRefAssets.push(asset);
      if (opts.apply) {
        try {
          await deps.db.delete(mediaAssets).where(and(eq(mediaAssets.id, asset.id), lt(mediaAssets.createdAt, zeroRefBefore)));
          await deps.storage.delete(asset.ossKey);
          report.deletedRows += 1;
          report.deletedObjects += 1;
          log(`deleted zero-ref asset ${asset.id} (${asset.ossKey})`);
        } catch (err) {
          report.errors.push(`zero-ref ${asset.ossKey}: ${String(err)}`);
        }
      }
    }

    // ---- 清理对象 ①：孤儿 OSS 对象（无 DB 记录 + 年龄 > 24h） ----
    const orphanBefore = new Date(now.getTime() - GC_ORPHAN_GRACE_MS);
    const objects = [...await deps.storage.list(MEDIA_KEY_PREFIX), ...await deps.storage.list("avatars/")];
    for (const obj of objects) {
      if (obj.lastModified.getTime() > orphanBefore.getTime()) continue; // 宽限期保护进行中的发布
      const rows = await deps.db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.ossKey, obj.key)).limit(1);
      if (rows.length > 0) continue;
      report.orphans.push(obj);
      if (opts.apply) {
        try {
          await deps.storage.delete(obj.key);
          report.deletedObjects += 1;
          log(`deleted orphan object ${obj.key}`);
        } catch (err) {
          report.errors.push(`orphan ${obj.key}: ${String(err)}`);
        }
      }
    }

    return report;
  } finally {
    await lock.release().catch((err) => log(`warning: failed to release advisory lock: ${String(err)}`));
  }
}
