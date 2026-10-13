import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { canAccess, readBodyCapped } from '@yoryon/core';
import { literalHits } from '@yoryon/config/search-text';
import { hash, unseal } from './search-state';
import { bodySearchEnabled } from './search';
import { ApiError } from '../errors';
import type { AppDeps } from '../deps';
import type { AppVariables } from '../middleware/auth';
const inputSchema = z.object({ session: z.uuid(), slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(200), revision: z.uuid(), after: z.number().int().min(0).max(10_000_000).default(0) }).strict();
export function searchLocateRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.post('/search/locate', async c => {
    c.header('Cache-Control', 'private, no-store');
    let input: unknown;
    try { input = JSON.parse(await readBodyCapped(c.req.raw, 2048) ?? ''); } catch { throw new ApiError(400, 'invalid_search', '定位参数无效'); }
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, 'invalid_search', '定位参数无效');
    const user = c.get('auth')?.user ?? null;
    const secret = deps.env.BFF_SHARED_SECRET;
    const anon = c.req.header('x-search-anonymous')?.split('.');
    if (!user && (!anon || hash(secret, `anon:${anon[0]}`) !== anon[1])) throw new ApiError(403, 'search_forbidden', '搜索会话不属于当前访问者');
    const identity = hash(secret, user ? `user:${user.id}` : `anon:${anon![0]}`);
    const network = hash(secret, `network:${c.get('clientIp').ip}`);
    if (deps.rateLimiter.consume(`locate:${network}`, 60, 60_000)) throw new ApiError(429, 'search_busy', '定位请求过于频繁');
    try {
      return await deps.db.transaction(async tx => {
        await tx.execute(sql`set local statement_timeout='1500ms'`);
        const saved = await tx.execute(sql`select query_cipher, epoch from search_sessions where id=${parsed.data.session}::uuid and identity=${identity} and expires_at > clock_timestamp()`);
        if (!saved.rows[0]) throw new ApiError(409, 'search_expired', '搜索会话已失效，请重新搜索');
        const rows = await tx.execute(sql`select c.id,c.visibility,c.revision,p.body_text,p.text_nodes from contents c
          join search_projections p on p.content_id=c.id and p.revision=c.revision where c.slug=${parsed.data.slug} and c.status='published'`);
        const r = rows.rows[0] as any;
        // Authorization before any positional response, including stale-position errors.
        if (!r || !await canAccess(tx, user, r, new Date())) throw new ApiError(403, 'search_forbidden', '开通订阅后可查看正文命中位置');
        const epoch = await tx.execute(sql`select version::text from search_epoch where id=1`);
        if (r.revision !== parsed.data.revision || String(saved.rows[0].epoch) !== String(epoch.rows[0]?.version)) throw new ApiError(409, 'search_expired', '内容已更新，请重新搜索');
        const query = unseal(secret, String(saved.rows[0].query_cipher));
        if (!bodySearchEnabled(query)) return c.json({ revision: r.revision, hits: [], nextAfter: null });
        const after = parsed.data.after;
        // Bounded navigation: at most 100 matches per request, keep global node offsets.
        const hits = literalHits(r.body_text.slice(after), query, [], 101).map(h => {
          const start = h.start + after; const end = h.end + after;
          return { start, end, nodes: (r.text_nodes as { id: string; start: number; end: number }[]).filter(n => n.end > start && n.start < end).map(n => ({ id: n.id, start: Math.max(0,start-n.start), end: Math.min(n.end,end)-n.start })) };
        });
        return c.json({ revision: r.revision, hits: hits.slice(0,100), nextAfter: hits.length > 100 ? hits[99]!.start+1 : null });
      }, { isolationLevel: 'repeatable read' });
    } catch (err) { if (err instanceof ApiError) throw err; throw new ApiError(503,'search_unavailable','定位暂时不可用，请重试'); }
  });
  return app;
}
