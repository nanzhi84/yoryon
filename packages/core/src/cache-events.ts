import { createHmac, randomUUID } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import { cacheEvents, catalogVersions, contents, collectionItems, collections, contentTags, tags, type Database } from "@yoryon/db";
import { contentTargets, isCatalogScope, validCacheEvent, type CacheEvent, type CacheTargets } from "@yoryon/config/cache";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function associations(tx: Tx, contentId: string) {
  const tagRows = await tx.select({ slug: tags.slug }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(eq(contentTags.contentId, contentId));
  const collRows = await tx.select({ slug: collections.slug }).from(collectionItems).innerJoin(collections, eq(collectionItems.collectionId, collections.id)).where(eq(collectionItems.contentId, contentId));
  const listings = await tx.select({ type: contents.type, visibility: contents.visibility, status: contents.status, showInHome: contents.showInHome })
    .from(contents).where(eq(contents.id, contentId));
  return { tags: tagRows.map(t => t.slug), collections: collRows.map(c => c.slug), listings };
}
export async function enqueueCacheEvent(tx: Tx, targets: CacheTargets, contentSlug: string | null = null, revision: string | null = null) {
  const event: CacheEvent = { id: randomUUID(), ...targets, contentSlug, revision };
  if (!validCacheEvent(event)) throw new Error("Invalid cache targets: use valid slugs and at most 100 targets per mutation");
  await tx.insert(cacheEvents).values({ id: event.id, payload: JSON.stringify(event) });
  // 固定加锁顺序；版本随事务回滚，重投递事件不会倒退或推进目录版本。
  for (const scope of [...new Set(event.tags.filter(isCatalogScope))].sort()) {
    await tx.insert(catalogVersions).values({ scope, version: event.id })
      .onConflictDoUpdate({ target: catalogVersions.scope, set: { version: event.id } });
  }
  return event;
}
export { contentTargets };

/** 每个请求都有截止时间，重定向禁止：配置目标须为可信站点根地址。 */
async function boundedFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
}
function sign(secret: string, time: string, body: string) {
  return createHmac("sha256", secret).update(`${time}.${body}`).digest("hex");
}

export async function deliverCacheEvents(db: Database, options: { retry?: boolean; logger?: (text: string) => void } = {}) {
  const log = options.logger ?? (() => {});
  const endpoint = process.env.CACHE_REVALIDATE_URL;
  const secret = process.env.CACHE_REVALIDATE_SECRET;
  const site = process.env.SITE_URL;
  // 正常投递在查询层排除重试耗尽事件（attempts>=3），避免最旧 100 条死信长期占满批次、阻塞后续新事件；
  // 人工 cache retry（retry:true）不过滤，保留恢复旧失败事件的能力（每次运行仍有界：每事件最多再试 3 次）。
  const rows = await db
    .select()
    .from(cacheEvents)
    .where(and(ne(cacheEvents.state, "verified"), options.retry ? undefined : lt(cacheEvents.attempts, 3)))
    .orderBy(cacheEvents.createdAt)
    .limit(100);
  for (const row of rows) {
    // 保留本地计数检查作为最后防线；并发互斥依赖调用方持有发布锁（row.attempts 是查询时快照）
    if (!options.retry && row.attempts >= 3) continue;
    if (!endpoint || !secret || !site) { log(`cache ${row.id}: pending (configuration missing)`); continue; }
    const event = JSON.parse(row.payload) as CacheEvent;
    let verified = false;
    const remaining = options.retry ? 3 : Math.max(0, 3 - row.attempts);
    for (let attempt = 0; attempt < remaining; attempt++) {
      try {
        const time = String(Date.now());
        const res = await boundedFetch(endpoint, { method: "POST", body: row.payload, headers: { "content-type": "application/json", "x-cache-time": time, "x-cache-signature": sign(secret, time, row.payload) } });
        if (!res.ok) throw new Error(`invalidation HTTP ${res.status}`);
        // 失效范围与预热范围分离；重试旧发布事件时，作品可能已下架/删除。
        // 先查当前公开投影，404 不预热。Next 流式 not-found 可以是 HTTP 200，不能据此验撤销。
        let contentUpdatedAt: string | null = null;
        if (event.contentSlug) {
          const expected = await boundedFetch(new URL(`/api/public/contents/${event.contentSlug}`, process.env.API_PUBLIC_URL ?? site).href);
          if (expected.status !== 404) {
            if (!expected.ok) throw new Error(`verification API HTTP ${expected.status}`);
            const current: unknown = await expected.json().catch(() => { throw new Error("verification API invalid JSON"); });
            if (!current || typeof current !== "object" || !("updatedAt" in current) ||
                typeof current.updatedAt !== "string" || Number.isNaN(Date.parse(current.updatedAt))) throw new Error("verification API invalid revision");
            contentUpdatedAt = current.updatedAt;
          }
        }
        const warmPaths = [...(event.tags.includes("feed") ? ["/"] : []), ...(event.contentSlug && contentUpdatedAt ? [`/p/${event.contentSlug}`] : [])];
        for (const p of warmPaths) {
          const response = await boundedFetch(new URL(p, site).href);
          const text = await response.text();
          if (response.status !== 200 && response.status !== 404) throw new Error(`warmup ${p}: HTTP ${response.status}`);
          if (p === "/") {
            const policy = await boundedFetch(new URL("/api/public/catalog-policy?scope=feed", process.env.API_PUBLIC_URL ?? site).href);
            if (!policy.ok) throw new Error(`verification policy HTTP ${policy.status}`);
            const { version } = await policy.json() as { version: string };
            if (response.status !== 200 || !text.includes(`data-catalog-version="${version}"`)) throw new Error("warmup /: catalog mismatch");
          }
          if (p.startsWith("/p/") && (response.status !== 200 || !text.includes(contentUpdatedAt!))) {
            throw new Error(`warmup ${p}: revision mismatch`);
          }
        }
        await db.update(cacheEvents).set({ state: "verified", verifiedAt: new Date(), lastError: null, attempts: row.attempts + attempt + 1 }).where(eq(cacheEvents.id, row.id));
        log(`cache ${row.id}: verified`);
        verified = true;
        break;
      } catch (error) {
        // 不持久化 URL/响应正文，避免泄露签名/内容。
        const message = error instanceof Error ? error.message : "cache delivery failed";
        await db.update(cacheEvents).set({ state: "failed", attempts: row.attempts + attempt + 1, lastError: message.replace(/https?:\/\/\S+/g, "[endpoint]").slice(0, 200) }).where(and(eq(cacheEvents.id, row.id), ne(cacheEvents.state, "verified")));
      }
    }
    if (!verified) log(`cache ${row.id}: pending (retry exhausted; blog cache retry)`);
  }
}
