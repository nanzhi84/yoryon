import { and, eq, inArray } from "drizzle-orm";
import { contents, contentMedia, type Database } from "@yoryon/db";
import { publicPreview, searchProjection, parseMarkdown, filterStoredMediaRefs, isMediaBlock } from "@yoryon/core";
import { readerLayoutSchema, type ReaderLayout } from "@yoryon/config/reader-layout";
type Reader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
type Node = { type: string; value?: string; depth?: number; children?: Node[] };
const textOf = (node: Node): string => node.type === "break" ? "\n" : node.value ?? node.children?.map(textOf).join("") ?? "";
const lengths = (node: Node) => textOf(node).split("\n").slice(0, 12).map(line =>
  Math.min(4000, Array.from(line).reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.55), 0)));

/** Derive only anonymous-visible geometry, never paid body structure or media IDs. */
export async function articleFeedSummaries(db: Reader, ids: string[], mediaBlockWeight: number) {
  if (!ids.length) return new Map<string, { excerpt: string; layout: ReaderLayout }>();
  const rows = await db.select({ id: contents.id, description: contents.description, bodyMarkdown: contents.bodyMarkdown, visibility: contents.visibility,
    revision: contents.revision, publicPreviewMarkdown: contents.publicPreviewMarkdown, previewRevision: contents.previewRevision,
    previewMode: contents.previewMode, previewPercent: contents.previewPercent }).from(contents)
    .where(and(inArray(contents.id, ids), eq(contents.type, "article"), eq(contents.status, "published")));
  const free = await db.select({ contentId: contentMedia.contentId, mediaId: contentMedia.mediaId }).from(contentMedia)
    .where(and(inArray(contentMedia.contentId, ids), eq(contentMedia.exposure, "free")));
  return new Map(rows.map(row => {
    const preview = publicPreview(row, mediaBlockWeight);
    const parsed = parseMarkdown(preview);
    const tree = row.visibility === "public" ? parsed : filterStoredMediaRefs(parsed,
      new Set(free.filter(m => m.contentId === row.id).map(m => m.mediaId)));
    const layout: ReaderLayout = [];
    const authoredSummary = tree.children.some((node, index) => node.type === "heading" && node.depth >= 2 && textOf(node).trim() === "本文要点"
      && ["paragraph", "list"].includes(tree.children[index + 1]?.type ?? ""));
    if (row.description.trim() && !authoredSummary) layout.push({ kind: "summary", lengths: lengths({ type: "text", value: row.description }) });
    for (const node of tree.children.slice(0, 12 - layout.length)) {
      if (isMediaBlock(node)) layout.push({ kind: "media", lengths: [] });
      else if (node.type === "heading") layout.push({ kind: "heading", level: node.depth, lengths: lengths(node) });
      else if (node.type === "list") layout.push({ kind: "list", lengths: node.children.slice(0, 12).map(item => lengths(item).reduce((a, b) => Math.min(4000, a + b), 0)) });
      else if (node.type === "code") layout.push({ kind: "code", lengths: lengths(node) });
      else if (node.type === "blockquote") layout.push({ kind: "quote", lengths: lengths(node) });
      else if (node.type === "thematicBreak") layout.push({ kind: "rule", lengths: [] });
      else if (node.type === "paragraph") layout.push({ kind: "paragraph", lengths: lengths(node) });
    }
    const characters = Array.from(searchProjection(preview).text.replace(/\s+/g, " ").trim());
    return [row.id, { excerpt: characters.slice(0, 160).join("") + (characters.length > 160 ? "…" : ""), layout: readerLayoutSchema.parse(layout) }];
  }));
}
