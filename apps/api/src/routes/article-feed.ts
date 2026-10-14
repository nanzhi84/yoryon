import { and, eq, inArray } from "drizzle-orm";
import { contents, type Database } from "@yoryon/db";
import { publicPreview, searchProjection } from "@yoryon/core";
type Reader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** 作者未提供description时，从匿名可见正文生成有界摘要；不改变作者元数据或输出付费全文。 */
export async function articleFeedSummaries(db: Reader, ids: string[], mediaBlockWeight: number) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db.select({ id: contents.id, bodyMarkdown: contents.bodyMarkdown, visibility: contents.visibility,
    revision: contents.revision, publicPreviewMarkdown: contents.publicPreviewMarkdown, previewRevision: contents.previewRevision,
    previewMode: contents.previewMode, previewPercent: contents.previewPercent }).from(contents)
    .where(and(inArray(contents.id, ids), eq(contents.type, "article"), eq(contents.status, "published")));
  return new Map(rows.map(row => {
    const text = searchProjection(publicPreview(row, mediaBlockWeight)).text.replace(/\s+/g, " ").trim();
    const characters = Array.from(text);
    return [row.id, characters.slice(0, 160).join("") + (characters.length > 160 ? "…" : "")];
  }));
}
