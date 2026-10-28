import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cache } from "react";
import {
  staticSiteSchema,
  type StaticContent,
  type StaticCollection,
} from "@yoryon/config/static-site";
import type { FeedContentItem } from "./types";

/** Build-time boundary: only a validated, already public snapshot enters rendered files. */
export const getSite = cache(() =>
  staticSiteSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), "../../content/site.json"), "utf8"))
  )
);
export const getContents = () => getSite().contents;
export const getContent = (slug: string) => getContents().find((c) => c.slug === slug) ?? null;
export const getCollections = () => getSite().collections;
export const getCollection = (slug: string) =>
  getCollections().find((c) => c.slug === slug) ?? null;
export function getTags() {
  const tags = new Map<string, { slug: string; name: string; count: number }>();
  for (const c of getContents())
    for (const tag of c.tags)
      tags.set(tag.slug, { ...tag, count: (tags.get(tag.slug)?.count ?? 0) + 1 });
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
export function toFeed(c: StaticContent): FeedContentItem {
  return {
    kind: "content",
    id: c.id,
    type: c.type,
    slug: c.slug,
    title: c.title,
    description: c.description,
    excerpt: c.searchText.slice(0, 160),
    visibility: c.visibility,
    coverMediaId: c.coverMediaId,
    publishedAt: c.publishedAt,
    isPinned: c.isPinned,
    tags: c.tags,
    likeCount: c.likeCount,
    commentCount: c.comments.filter((x) => !x.deleted).length,
    post:
      c.type === "post" ? { bodyMarkdown: c.bodyMarkdown, collapsed: false, media: c.media } : null,
  };
}
export function feed(items: StaticContent[], pinned = true) {
  return [...items]
    .sort(
      (a, b) =>
        (pinned ? Number(b.isPinned) - Number(a.isPinned) : 0) ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        b.id.localeCompare(a.id)
    )
    .map(toFeed);
}
export const collectionList = (c: StaticCollection) => ({ ...c, itemCount: c.items.length });
