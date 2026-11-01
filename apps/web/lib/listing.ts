import type { FeedContentItem, CollectionListItem } from "./types";
import type { ChapterItem } from "./collection-resume";

export type RichNode = string | { tag: string; props: Record<string, unknown>; children: RichNode[] };
export type FeedRow = Omit<FeedContentItem, "post"> & { body: RichNode[] | null };
export type CollectionRow = CollectionListItem & { introduction: RichNode[] };
type Header = { schema: 1; page: number; total: number };
export type Listing = Header & (
  | { kind: "feed"; pinned: boolean; items: FeedRow[] }
  | { kind: "collections"; items: CollectionRow[] }
  | { kind: "chapters"; slug: string; items: ChapterItem[] }
  | { kind: "tags"; items: { slug: string; name: string; count: number }[] }
);
export const richTags = new Set("p strong em br a img ul ol li blockquote pre code span div hr h1 h2 h3 h4 h5 h6 del table thead tbody tr th td input video-player audio-player work-reference".split(" "));
const properties = new Set("className href src alt title width height start type checked disabled id data-search-node data-post-blank-lines data-post-trailing-lines aria-hidden ariaHidden hidden durationSec dataRoot".split(" "));
export function safeRichProps(input: Record<string, unknown>) {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (properties.has(key) && ["string", "number", "boolean"].includes(typeof value)) {
      if ((key === "src" || key === "href") && typeof value === "string" && /^(?:javascript|data|vbscript):/i.test(value.trim())) continue;
      props[key] = value;
    } else if (key === "style" && value && typeof value === "object") {
      props.style = Object.fromEntries(Object.entries(value).filter(([k, v]) =>
        ["marginTop", "margin", "height"].includes(k) && ["string", "number"].includes(typeof v)));
    }
  }
  return props;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("内容格式无效，请刷新后重试。");
  return value as Record<string, unknown>;
}
function rich(value: unknown, depth = 0): RichNode[] {
  if (!Array.isArray(value) || depth > 64) throw new Error("正文格式无效。");
  return value.map(node => {
    if (typeof node === "string") return node;
    const n = record(node);
    if (typeof n.tag !== "string" || !richTags.has(n.tag)) throw new Error("正文格式无效。");
    return { tag: n.tag, props: safeRichProps(record(n.props)), children: rich(n.children, depth + 1) };
  });
}
/** Network boundary: never spread unvalidated JSON into React elements. */
export function parseListing(value: unknown, expected: Listing, page: number): Listing {
  const data = record(value);
  if (data.schema !== 1 || data.page !== page || data.total !== expected.total || data.kind !== expected.kind ||
      !Array.isArray(data.items) || data.items.length !== Math.min(12, expected.total - (page - 1) * 12) ||
      (expected.kind === "chapters" && data.slug !== expected.slug) || (expected.kind === "feed" && data.pinned !== expected.pinned))
    throw new Error("内容已更新，请刷新页面。");
  for (const item of data.items) {
    const row = record(item);
    if (typeof row.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(row.slug)) throw new Error("内容地址无效。");
    if (data.kind === "tags") {
      if (typeof row.name !== "string" || !Number.isSafeInteger(row.count) || Number(row.count) < 0) throw new Error("标签格式无效。");
    } else {
      if (typeof row.id !== "string" || typeof row.title !== "string") throw new Error("内容格式无效。");
      if (data.kind === "feed") {
        if (!["article", "post"].includes(String(row.type)) || typeof row.description !== "string" ||
          typeof row.isPinned !== "boolean" || (row.publishedAt !== null && typeof row.publishedAt !== "string")) throw new Error("内容格式无效。");
        row.body = row.body === null ? null : rich(row.body);
      } else if (data.kind === "collections") {
        if (!Number.isSafeInteger(row.itemCount) || typeof row.updatedAt !== "string") throw new Error("合集格式无效。");
        row.introduction = rich(row.introduction);
      } else if (!Number.isSafeInteger(row.position) || Number(row.position) < 1 || Number(row.position) > expected.total ||
        (row.publishedAt !== null && typeof row.publishedAt !== "string")) throw new Error("章节格式无效。");
    }
  }
  return data as unknown as Listing;
}
