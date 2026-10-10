/**
 * 发布 / GC 互斥锁（ADR-0006 修订）。
 * 会话级 advisory lock，生命周期绑定专用 pg.Client：
 * - 锁连接异常或锁状态不可确认时安全中止（release 失败仅记录——连接断开时锁自动释放）；
 * - 进程退出 / 连接断开 → 锁自动释放，无残留锁。
 */
import type pg from "pg";
import { PUBLISH_GC_LOCK_NAME } from "@yoryon/config";

export interface LockClient extends Pick<pg.Client, "query"> {}

export interface AdvisoryLock {
  release: () => Promise<void>;
}

/** blocking=true：pg_advisory_lock（发布）；false：pg_try_advisory_lock（GC，失败即跳过）。 */
export async function acquirePublishGcLock(
  client: LockClient,
  opts: { blocking: boolean; name?: string },
): Promise<AdvisoryLock> {
  const name = opts.name ?? PUBLISH_GC_LOCK_NAME;
  if (opts.blocking) {
    await client.query(`select pg_advisory_lock(hashtextextended($1, 0))`, [name]);
    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        await client.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [name]);
      },
    };
  }
  const res = await client.query(`select pg_try_advisory_lock(hashtextextended($1, 0)) as locked`, [name]);
  const locked = (res.rows[0] as { locked: boolean } | undefined)?.locked === true;
  if (!locked) {
    throw new GcLockUnavailableError();
  }
  let released = false;
  return {
    release: async () => {
      if (released) return;
      released = true;
      await client.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [name]);
    },
  };
}

export class GcLockUnavailableError extends Error {
  constructor() {
    super("publish/gc advisory lock unavailable: a publish is likely in progress");
    this.name = "GcLockUnavailableError";
  }
}
