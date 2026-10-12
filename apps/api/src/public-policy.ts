import { eq, desc } from "drizzle-orm";
import { cacheEvents, contents, type Database } from "@yoryon/db";

/** 单 API 进程的撤销门禁。请求只读内存；业务发布同步刷新后才报告生效。
 * 重启首次请求从数据库重建，失败不返回旧状态。扩展多实例前必须改为共享强一致存储。
 */
export function createPublicPolicy(db: Database) {
  let snapshot: Map<string, { revision: string }> | null = null;
  let epoch = "00000000-0000-0000-0000-000000000000";
  let loading: Promise<void> | null = null;
  let refreshTail = Promise.resolve();
  function refresh() {
    const operation = refreshTail.then(async () => {
    const rows = await db.select({ slug: contents.slug, revision: contents.revision }).from(contents).where(eq(contents.status, "published"));
    const events = await db.select({ id: cacheEvents.id }).from(cacheEvents).orderBy(desc(cacheEvents.createdAt), desc(cacheEvents.id)).limit(1);
    snapshot = new Map(rows.map(row => [row.slug, { revision: row.revision }]));
    epoch = events[0]?.id ?? "00000000-0000-0000-0000-000000000000";
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
  };
}
export type PublicPolicy = ReturnType<typeof createPublicPolicy>;
