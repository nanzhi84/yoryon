import { resolve } from "node:path";
import { readStaticCatalog } from "@yoryon/config/static-catalog";
import type { StaticContent, StaticCollection } from "@yoryon/config/static-site";
import type { FeedContentItem } from "./types";

// Build/server boundary: never imported by client components.
export const getCatalog = () => readStaticCatalog(resolve(process.cwd(), "../../content/site.json"));
export const getSite = () => getCatalog().site;
export const getContents = () => getSite().contents;
export const getContent = (slug: string) => getCatalog().bySlug.get(slug) ?? null;
export const getCollections = () => getSite().collections;
export const getCollection = (slug: string) => getCatalog().collectionsBySlug.get(slug) ?? null;
export const getTags = () => getCatalog().tags;
export const getTag = (slug: string) => getCatalog().tagsBySlug.get(slug) ?? null;
export const getTagContents = (slug: string) => getCatalog().tagged.get(slug) ?? [];
export const staticDataRoot = () => `/data/static/${getCatalog().version}`;

export function toFeed(c: StaticContent): FeedContentItem {
  return {
    kind: "content", id: c.id, type: c.type, slug: c.slug, title: c.title,
    description: c.description, excerpt: c.searchText.slice(0, 160),
    visibility: c.visibility, coverMediaId: c.coverMediaId, publishedAt: c.publishedAt,
    isPinned: c.isPinned, tags: c.tags,
    post: c.type === "post" ? { bodyMarkdown: c.bodyMarkdown, collapsed: false, media: c.media } : null,
  };
}
export const collectionList = (c: StaticCollection) => ({
  id: c.id, slug: c.slug, title: c.title, description: c.description, visibility: c.visibility,
  coverMediaId: c.coverMediaId, updatedAt: c.updatedAt, isPinned: c.isPinned, itemCount: c.items.length,
});
