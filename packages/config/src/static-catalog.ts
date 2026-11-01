import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { publicCollections, staticSiteSchema, type StaticContent } from "./static-site";

function chronological(a: StaticContent, b: StaticContent) {
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.id.localeCompare(a.id);
}
function unique<T>(items: readonly T[], key: (item: T) => string) {
  const result = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (result.has(id)) throw new Error("静态快照含重复标识");
    result.set(id, item);
  }
  return result as ReadonlyMap<string, T>;
}
/** Validated public catalog shared by renders within one build worker. */
function catalog(source: string) {
  const parsed = staticSiteSchema.parse(JSON.parse(source));
  unique(parsed.contents, c => c.id);
  const collections = publicCollections(parsed.collections, parsed.contents);
  unique(collections, c => c.id);
  for (const collection of collections) unique(collection.items, item => item.id);
  const visible = new Set(collections.map(c => c.id));
  const contents = parsed.contents.map(c => ({
    ...c, collections: c.collections.filter(entry => visible.has(entry.id)),
  }));
  const tags = new Map<string, { slug: string; name: string; count: number }>();
  const tagged = new Map<string, StaticContent[]>();
  for (const content of [...contents].sort(chronological)) {
    for (const tag of content.tags) {
      if (!tags.has(tag.slug)) tags.set(tag.slug, { ...tag, count: 0 });
      tags.get(tag.slug)!.count++;
      if (!tagged.has(tag.slug)) tagged.set(tag.slug, []);
      tagged.get(tag.slug)!.push(content);
    }
  }
  const home = [...contents].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || chronological(a, b));
  return {
    site: { ...parsed, contents, collections },
    version: createHash("sha256").update(source).digest("hex").slice(0, 20),
    bySlug: unique(contents, c => c.slug),
    collectionsBySlug: unique(collections, c => c.slug),
    mediaById: unique(parsed.assets, asset => asset.id),
    tags: [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    tagsBySlug: tags as ReadonlyMap<string, { slug: string; name: string; count: number }>,
    tagged: tagged as ReadonlyMap<string, readonly StaticContent[]>,
    articles: home.filter(c => c.type === "article" && c.showInHome),
    posts: home.filter(c => c.type === "post" && c.showInHome),
  };
}
let current: { path: string; stamp: string; value: ReturnType<typeof catalog> } | undefined;
export function readStaticCatalog(path: string) {
  const file = statSync(path);
  const stamp = `${file.ino}:${file.mtimeMs}:${file.ctimeMs}:${file.size}`;
  if (!current || current.path !== path || current.stamp !== stamp) {
    current = { path, stamp, value: catalog(readFileSync(path, "utf8")) };
  }
  return current.value;
}
