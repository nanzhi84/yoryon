/** 身份无关的缓存标识协议；此模块不得依赖 DB、存储或 Node API。 */
export const CACHE_TTL = 86400;
export const cacheTags = {
  feed: "feed", collections: "collections", sitemap: "sitemap",
  content: (slug: string) => `content:${slug}`,
  tag: (slug: string) => `tag:${slug}`,
  collection: (slug: string) => `collection:${slug}`,
};
export interface CacheTargets { tags: string[]; paths: string[] }
export interface CacheEvent extends CacheTargets {
  id: string;
  contentSlug: string | null;
  revision: string | null;
}
export function contentTargets(slug: string, tags: string[], collections: string[]): CacheTargets {
  return {
    tags: [...new Set([cacheTags.feed, cacheTags.collections, cacheTags.sitemap, cacheTags.content(slug), ...tags.map(cacheTags.tag), ...collections.map(cacheTags.collection)])],
    paths: [...new Set(["/", "/c", "/sitemap.xml", `/p/${slug}`, ...tags.map(t => `/tags/${t}`), ...collections.map(c => `/c/${c}`)])],
  };
}
export function validCacheEvent(value: unknown): value is CacheEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as CacheEvent;
  const slug = /^[a-z0-9][a-z0-9-]*$/;
  return /^[0-9a-f-]{36}$/.test(e.id) &&
    (e.contentSlug === null || typeof e.contentSlug === "string" && slug.test(e.contentSlug)) &&
    (e.revision === null || typeof e.revision === "string" && !Number.isNaN(Date.parse(e.revision))) &&
    Array.isArray(e.tags) && e.tags.length <= 100 && e.tags.every(t => typeof t === "string" && /^(feed|collections|sitemap|(?:content|tag|collection):[a-z0-9][a-z0-9-]*)$/.test(t)) &&
    Array.isArray(e.paths) && e.paths.length <= 100 && e.paths.every(p => typeof p === "string" && /^(\/|\/c|\/sitemap\.xml|\/(?:p|tags|c)\/[a-z0-9][a-z0-9-]*)$/.test(p));
}
