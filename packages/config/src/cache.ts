/** 身份无关的缓存标识协议；此模块不得依赖 DB、存储或 Node API。 */
export const CACHE_TTL = 86400;
export const cacheTags = {
  feed: "feed", postFeed: "post-feed", paidFeed: "paid-feed", memberFeed: "member-feed",
  collections: "collections", tags: "tags", sitemap: "sitemap",
  content: (slug: string) => `content:${slug}`,
  tag: (slug: string) => `tag:${slug}`,
  collection: (slug: string) => `collection:${slug}`,
};
export type CatalogScope = "feed" | "post-feed" | "paid-feed" | "member-feed" | "collections" | `tag:${string}`;
export function isCatalogScope(value: string): value is CatalogScope {
  return /^(feed|post-feed|paid-feed|member-feed|collections|tag:[a-z0-9][a-z0-9-]*)$/.test(value);
}
export function catalogScopeForSource(source: string): CatalogScope | null {
  const scope = source.startsWith("tag-") ? `tag:${source.slice(4)}` : source;
  return isCatalogScope(scope) && scope !== "collections" ? scope : null;
}
export function catalogScopeForPath(path: string): CatalogScope {
  const source = path.startsWith("/api/tags/") ? `tag-${path.slice(10)}` : path.slice(5);
  const scope = catalogScopeForSource(source);
  if (!scope) throw new Error("Invalid catalog path");
  return scope;
}
export interface CacheTargets { tags: string[]; paths: string[] }
export interface CacheEvent extends CacheTargets {
  id: string;
  /** 仅直接修改的作品需要主动预热；关联失效不设置此字段。 */
  contentSlug: string | null;
  revision: string | null;
}
export interface ContentListing {
  type: "article" | "post";
  visibility: "public" | "paid";
  status: "draft" | "published";
  showInHome: boolean;
}
export function contentTargets(slug: string, tags: string[], collections: string[], listings: ContentListing[]): CacheTargets {
  const affected = new Set<string>([cacheTags.sitemap, cacheTags.tags, cacheTags.content(slug), ...tags.map(cacheTags.tag), ...collections.map(cacheTags.collection)]);
  for (const item of listings) {
    if (item.status !== "published") continue;
    if (item.showInHome) affected.add(item.type === "article" ? cacheTags.feed : cacheTags.postFeed);
    if (item.visibility === "paid") { affected.add(cacheTags.paidFeed); affected.add(cacheTags.memberFeed); }
  }
  // 合集 updatedAt、成员数及订阅聚合可能因成员发布/撤销变化。
  if (collections.length) { affected.add(cacheTags.collections); affected.add(cacheTags.memberFeed); }
  return {
    tags: [...affected],
    paths: [...new Set(["/sitemap.xml", `/p/${slug}`, ...(affected.has(cacheTags.feed) ? ["/"] : []),
      ...(affected.has(cacheTags.postFeed) ? ["/posts"] : []), ...(collections.length ? ["/c"] : []),
      ...tags.map(t => `/tags/${t}`), ...collections.map(c => `/c/${c}`)])],
  };
}
export function validCacheEvent(value: unknown): value is CacheEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as CacheEvent;
  const slug = /^[a-z0-9][a-z0-9-]*$/;
  return /^[0-9a-f-]{36}$/.test(e.id) &&
    (e.contentSlug === null || typeof e.contentSlug === "string" && slug.test(e.contentSlug)) &&
    (e.revision === null || typeof e.revision === "string" && !Number.isNaN(Date.parse(e.revision))) &&
    Array.isArray(e.tags) && e.tags.length <= 100 && e.tags.every(t => typeof t === "string" && /^(feed|post-feed|paid-feed|member-feed|collections|tags|sitemap|(?:content|tag|collection):[a-z0-9][a-z0-9-]*)$/.test(t)) &&
    Array.isArray(e.paths) && e.paths.length <= 100 && e.paths.every(p => typeof p === "string" && /^(\/|\/posts|\/c|\/sitemap\.xml|\/(?:p|tags|c)\/[a-z0-9][a-z0-9-]*)$/.test(p));
}
