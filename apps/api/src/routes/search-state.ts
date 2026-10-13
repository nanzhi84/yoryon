import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '@yoryon/db';
import { ApiError } from '../errors';
export type SearchTx = Parameters<Parameters<Database['transaction']>[0]>[0];
export const hash = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');
export function seal(secret: string, value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(secret: string, value: string) {
  const data = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
}
export interface StoredSearch { id: string; query_hash: string; query_cipher: string; epoch: string; results: { id: string; revision: string }[] }
export async function quota(tx: SearchTx, identity: string, network: string, unlimited: boolean) {
  if (unlimited) return { remaining: null, releasesAt: null };
  // The shared network ledger includes anonymous + free users; clearing cookies,
  // switching accounts and logging in never resets the network budget.
  const rows = await tx.execute(sql`select bucket, count(*)::int used, min(created_at) + interval '60 minutes' releases
    from (select 'identity' bucket, created_at from search_sessions where identity=${identity} and metered and created_at > clock_timestamp()-interval '60 minutes'
      union all select 'network', created_at from search_sessions where network=${network} and metered and created_at > clock_timestamp()-interval '60 minutes') q group by bucket`);
  const counts = rows.rows as { used: number; releases: Date }[];
  const used = Math.max(0, ...counts.map(r => r.used));
  const exhausted = counts.filter(r => r.used >= 10);
  // Both buckets must release; the later first-release determines recovery.
  const releases = exhausted.length ? exhausted : counts;
  return { remaining: Math.max(0, 10-used), releasesAt: releases.length ? new Date(Math.max(...releases.map(r => new Date(r.releases).getTime()))).toISOString() : null };
}
export async function page(tx: SearchTx, saved: StoredSearch, offset: number, query: string, user: { id: string; role: 'admin' | 'user' } | null, bodySearch: boolean) {
  const epoch = await tx.execute(sql`select version::text from search_epoch where id=1`);
  if (String(epoch.rows[0]?.version) !== String(saved.epoch)) throw new ApiError(409, 'search_expired', '内容已更新，请重新搜索');
  const selected = saved.results.slice(offset, offset + 20);
  if (!selected.length) return [];
  // Only this page's projections are loaded; authorization is repeated on every page.
  const ids = selected.map(r => r.id);
  const rows = await tx.execute(sql`select c.id, c.type, c.slug, c.title, c.description, c.visibility, c.published_at, c.revision,
    p.body_text, p.text_nodes from contents c join search_projections p on p.content_id=c.id and p.revision=c.revision
    where c.status='published' and c.id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`,`)})`);
  const found = rows.rows as any[];
  if (found.length !== selected.length || selected.some(s => !found.some(r => r.id === s.id && r.revision === s.revision))) throw new ApiError(409, 'search_expired', '内容已更新，请重新搜索');
  const { canAccessMany } = await import('@yoryon/core');
  const { literalHits } = await import('@yoryon/config/search-text');
  const access = await canAccessMany(tx, user, found, new Date());
  return selected.map(s => {
    const r = found.find(r => r.id === s.id)!;
    const allowed = access.get(r.id) === true;
    return { id: r.id, type: r.type, slug: r.slug, title: r.title, description: r.description, visibility: r.visibility,
      publishedAt: r.published_at == null ? null : new Date(r.published_at).toISOString(), canAccess: allowed,
      // Unauthorized body gets neither revision/location/count nor a body-match flag.
      ...(allowed ? { revision: r.revision, hits: bodySearch ? literalHits(r.body_text, query, r.text_nodes, 3) : [] } : {}) };
  });
}
