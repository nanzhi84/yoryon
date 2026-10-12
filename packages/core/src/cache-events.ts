import { createHmac, randomUUID } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import { cacheEvents, collectionItems, collections, contentTags, tags, type Database } from "@yoryon/db";
import { contentTargets, validCacheEvent, type CacheEvent, type CacheTargets } from "@yoryon/config/cache";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function associations(tx: Tx, contentId: string) {
  const tagRows = await tx.select({ slug: tags.slug }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(eq(contentTags.contentId, contentId));
  const collRows = await tx.select({ slug: collections.slug }).from(collectionItems).innerJoin(collections, eq(collectionItems.collectionId, collections.id)).where(eq(collectionItems.contentId, contentId));
  return { tags: tagRows.map(t => t.slug), collections: collRows.map(c => c.slug) };
}
export async function enqueueCacheEvent(tx: Tx, targets: CacheTargets, contentSlug: string | null = null, revision: string | null = null) {
  const event: CacheEvent = { id: randomUUID(), ...targets, contentSlug, revision };
  if (!validCacheEvent(event)) throw new Error("Invalid cache targets: use valid slugs and at most 100 targets per mutation");
  await tx.insert(cacheEvents).values({ id: event.id, payload: JSON.stringify(event) });
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
        // 仅允许协议白名单路径，绝不消费 webhook 中任意 URL。
        for (const p of event.paths) {
          const response = await boundedFetch(new URL(p, site).href, { headers: { "cache-control": "no-cache" } });
          const text = await response.text();
          if (response.status !== 200 && response.status !== 404) throw new Error(`warmup ${p}: HTTP ${response.status}`);
          if (p === "/" || p === "/c" || p.startsWith("/tags/")) {
            const policy = await boundedFetch(new URL("/api/public/catalog-policy", process.env.API_PUBLIC_URL ?? site).href);
            if (!policy.ok) throw new Error(`verification policy HTTP ${policy.status}`);
            const { version } = await policy.json() as { version: string };
            if (response.status === 200 && !text.includes(`data-catalog-version="${version}"`)) throw new Error(`warmup ${p}: catalog mismatch`);
          }
          if (p === "/sitemap.xml") {
            const expected = await boundedFetch(new URL("/api/sitemap", process.env.API_PUBLIC_URL ?? site).href);
            if (!expected.ok) throw new Error(`verification sitemap API HTTP ${expected.status}`);
            const data = await expected.json() as { entries: { path: string }[] };
            const actual = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]!).pathname).filter(path => path.startsWith("/p/") || path.startsWith("/c/"));
            if (JSON.stringify(actual.sort()) !== JSON.stringify(data.entries.map(e => e.path).sort())) throw new Error("warmup sitemap: membership mismatch");
          }
          if (p.startsWith("/p/")) {
            const expected = await boundedFetch(new URL(`/api/public/contents/${p.slice(3)}`, process.env.API_PUBLIC_URL ?? site).href);
            if (expected.status === 404) {
              if (response.status !== 404) throw new Error(`warmup ${p}: expected 404`);
            } else {
              if (!expected.ok) throw new Error(`verification API HTTP ${expected.status}`);
              const current = await expected.json() as { title: string; updatedAt: string };
              if (response.status !== 200 || !text.includes(current.updatedAt)) throw new Error(`warmup ${p}: revision mismatch`);
            }
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
