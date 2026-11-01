import type { readStaticCatalog } from "@yoryon/config/static-catalog";
import type { StaticContent, StaticCollection } from "@yoryon/config/static-site";
import { PAGE_SIZE, pageItems } from "./pagination";
import { listingMarkdown } from "./listing-markdown";
import type { Listing } from "./listing";
type Catalog = ReturnType<typeof readStaticCatalog>;
const header = (page: number, total: number) => ({ schema: 1 as const, page, total });
const markdownOptions = (c: Catalog) => ({ root: `/data/static/${c.version}`, media: c.mediaById });
export function feedListing(catalog: Catalog, all: readonly StaticContent[], page: number, pinned: boolean): Listing {
  return { ...header(page, all.length), kind: "feed", pinned, items: (pageItems(all, page) ?? []).map(c => ({
    kind: "content", id: c.id, type: c.type, slug: c.slug, title: c.title, description: c.description,
    excerpt: c.searchText.slice(0, 160), visibility: c.visibility, coverMediaId: c.coverMediaId,
    publishedAt: c.publishedAt, isPinned: c.isPinned, tags: c.tags,
    body: c.type === "post" ? listingMarkdown(c.bodyMarkdown, { ...markdownOptions(catalog), sizes: c.media }) : null,
  })) };
}
export function collectionListing(catalog: Catalog, page: number): Listing {
  const all = catalog.site.collections;
  return { ...header(page, all.length), kind: "collections", items: (pageItems(all, page) ?? []).map(c => ({
    id: c.id, slug: c.slug, title: c.title, description: c.description, visibility: c.visibility,
    coverMediaId: c.coverMediaId, updatedAt: c.updatedAt, isPinned: c.isPinned, itemCount: c.items.length,
    introduction: listingMarkdown(c.description, { ...markdownOptions(catalog), simple: true }),
  })) };
}
export function chapterListing(collection: StaticCollection, page: number, reverse: boolean): Listing {
  const total = collection.items.length, offset = (page - 1) * PAGE_SIZE;
  return { ...header(page, total), kind: "chapters", slug: collection.slug,
    items: (pageItems(collection.items, page, reverse) ?? []).map((item, i) => ({
      id: item.id, slug: item.slug, title: item.title, publishedAt: item.publishedAt,
      position: reverse ? total - offset - i : offset + i + 1,
    })) };
}
export function tagListing(catalog: Catalog, page: number): Listing {
  return { ...header(page, catalog.tags.length), kind: "tags", items: pageItems(catalog.tags, page) ?? [] };
}
