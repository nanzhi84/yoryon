import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { hasActiveSubscription, readBodyCapped } from '@yoryon/core';
import { ApiError } from '../errors';
import type { AppDeps } from '../deps';
import type { AppVariables } from '../middleware/auth';
import { hash, seal, unseal, quota, page, type StoredSearch } from './search-state';

const newSearch = z.object({ query: z.string().min(1).max(120).refine(q => q.trim().length > 0 && !q.includes('\0')), requestId: z.uuid() }).strict();
const nextPage = z.object({ session: z.uuid(), cursor: z.number().int().min(0).max(980).refine(n => n % 20 === 0) }).strict();
// pg_trgm has no selective interior trigrams for punctuation/1–2 letters.
export function bodySearchEnabled(query: string) { return /[\p{L}\p{N}]{3}/u.test(query); }
export function searchRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  let active = 0;
  app.post('/search', async c => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Referrer-Policy', 'no-referrer');
    const raw = await readBodyCapped(c.req.raw, 2048);
    let input: unknown;
    try { input = JSON.parse(raw ?? ''); } catch { throw new ApiError(400, 'invalid_search', '搜索参数无效'); }
    const fresh = newSearch.safeParse(input);
    const continuation = nextPage.safeParse(input);
    if (!fresh.success && !continuation.success) throw new ApiError(400, 'invalid_search', '搜索参数无效（最多 120 个字符）');
    const secret = deps.env.BFF_SHARED_SECRET;
    const user = c.get('auth')?.user ?? null;
    const network = hash(secret, `network:${c.get('clientIp').ip}`);
    const cookie = c.req.header('x-search-anonymous');
    // Server-issued HMAC token: clients cannot invent anonymous identities.
    let anonymous = cookie?.split('.');
    if (!anonymous || anonymous.length !== 2 || !z.uuid().safeParse(anonymous[0]).success || hash(secret, `anon:${anonymous[0]}`) !== anonymous[1]) {
      const id = randomUUID(); anonymous = [id, hash(secret, `anon:${id}`)];
    }
    c.header('x-search-anonymous', anonymous.join('.'));
    const identity = hash(secret, user ? `user:${user.id}` : `anon:${anonymous[0]}`);
    const wait = deps.rateLimiter.consume(`search:${network}`, 40, 60_000);
    if (wait || active >= 4) throw new ApiError(429, 'search_busy', '搜索繁忙，请稍后重试');
    active++;
    try {
      return await deps.db.transaction(async tx => {
        await tx.execute(sql`set local statement_timeout='1500ms'`);
        await tx.execute(sql`set local lock_timeout='1000ms'`);
        // Consistent order across identities on a shared network; advisory locks
        // serialize the ledger before checking budget or doing any full-text work.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${network}, 23))`);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity}, 24))`);
        const unlimited = user?.role === 'admin' || !!user && await hasActiveSubscription(tx, user.id, new Date());
        let saved: StoredSearch | undefined;
        let offset = 0;
        let query: string;
        if (continuation.success) {
          const rows = await tx.execute(sql`select * from search_sessions where id=${continuation.data.session}::uuid and identity=${identity} and expires_at > clock_timestamp()`);
          saved = rows.rows[0] as unknown as StoredSearch;
          if (!saved) throw new ApiError(409, 'search_expired', '搜索会话已失效，请重新搜索');
          offset = continuation.data.cursor;
          if (offset >= saved.results.length && offset !== 0) throw new ApiError(400, 'invalid_cursor', '分页位置无效');
          query = unseal(secret, saved.query_cipher);
        } else {
          const data = fresh.data!;
          // Expired idempotency keys may be reused after the rolling window.
          // Incremental pruning bounds encrypted-query retention during traffic.
          await tx.execute(sql`delete from search_sessions where identity=${identity} and request_id=${data.requestId}::uuid and expires_at <= clock_timestamp()`);
          await tx.execute(sql`delete from search_sessions where id in (select id from search_sessions where expires_at <= clock_timestamp() order by expires_at limit 100)`);
          query = data.query;
          const prior = await tx.execute(sql`select * from search_sessions where identity=${identity} and request_id=${data.requestId}::uuid and expires_at > clock_timestamp()`);
          saved = prior.rows[0] as unknown as StoredSearch;
          if (saved && saved.query_hash !== hash(secret, query)) throw new ApiError(400, 'search_replay', '重复请求参数不一致');
          if (!saved) {
            const allowance = await quota(tx, identity, network, unlimited);
            if (allowance.remaining === 0) return c.json({ error: { code: 'search_quota_exhausted', message: '本小时搜索次数已用完' }, quota: allowance }, 429);
            // Missing/stale projections fail closed until CLI rebuild completes.
            const missing = await tx.execute(sql`select c.id from contents c left join search_projections p on p.content_id=c.id and p.revision=c.revision where c.status='published' and p.content_id is null limit 1`);
            if (missing.rows.length) throw new ApiError(503, 'search_unavailable', '搜索索引正在重建，请稍后重试');
            const pattern = '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
            const body = bodySearchEnabled(query);
            const candidates = await tx.execute(sql`with candidates as materialized (
              select c.id, c.revision, c.published_at,
                case when strpos(p.title, ${query}) > 0 then 0 when strpos(p.description, ${query}) > 0 then 1 else 2 end rank
              from search_projections p join contents c on c.id=p.content_id and c.revision=p.revision
              where c.status='published' and (p.title like ${pattern} or p.description like ${pattern} ${body ? sql`or p.body_text like ${pattern}` : sql``})
              limit 1001)
              select id, revision from candidates order by rank, published_at desc nulls last, id desc`);
            if (candidates.rows.length > 1000) throw new ApiError(422, 'search_too_broad', '命中范围过大，请输入更长的连续原文');
            const epoch = await tx.execute(sql`select version::text from search_epoch where id=1`);
            saved = { id: randomUUID(), query_hash: hash(secret, query), query_cipher: seal(secret, query), epoch: String(epoch.rows[0]?.version), results: candidates.rows as any };
            await tx.execute(sql`insert into search_sessions(id,identity,network,request_id,query_hash,query_cipher,epoch,results,metered,expires_at)
              values(${saved.id}::uuid,${identity},${network},${data.requestId}::uuid,${saved.query_hash},${saved.query_cipher},${saved.epoch}::bigint,${JSON.stringify(saved.results)}::jsonb,${!unlimited},clock_timestamp()+interval '60 minutes')`);
          }
        }
        const results = await page(tx, saved, offset, query, user, bodySearchEnabled(query));
        const allowance = await quota(tx, identity, network, unlimited);
        return c.json({ session: saved.id, query, results, nextCursor: offset + 20 < saved.results.length ? offset+20 : null, quota: allowance, bodySearch: bodySearchEnabled(query) });
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Only a bounded database error code is diagnostic; no SQL/parameters.
      const cause = (err as { cause?: { code?: string }; code?: string })?.cause ?? err as { code?: string };
      const code = /^[A-Z0-9]{5}$/.test(cause?.code ?? '') ? cause.code : 'UNKNOWN';
      console.warn(JSON.stringify({ level: 'warn', msg: 'search unavailable', requestId: c.get('requestId'), code }));
      throw new ApiError(503, 'search_unavailable', '搜索暂时不可用，请稍后重试');
    } finally { active--; }
  });
  return app;
}
