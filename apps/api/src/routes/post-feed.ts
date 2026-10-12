import { and, eq, inArray } from "drizzle-orm";
import { contents, contentMedia, mediaAssets, type Database } from "@yoryon/db";
import { truncateForPreview } from "@yoryon/core";

type Reader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** 先做匿名权限裁剪，再做首页折叠；绝不投影付费全文或隐藏媒体。 */
export async function postFeedBodies(db: Reader, ids: string[], mediaBlockWeight: number) {
  if (!ids.length) return new Map<string, unknown>();
  const rows = await db.select({ id: contents.id, body: contents.bodyMarkdown, visibility: contents.visibility,
    previewMode: contents.previewMode, previewPercent: contents.previewPercent }).from(contents)
    .where(and(inArray(contents.id, ids), eq(contents.type, "post"), eq(contents.status, "published")));
  const media = await db.select({ contentId: contentMedia.contentId, mediaId: contentMedia.mediaId,
    mimeType: mediaAssets.mimeType, width: mediaAssets.width, height: mediaAssets.height }).from(contentMedia)
    .innerJoin(mediaAssets, eq(contentMedia.mediaId, mediaAssets.id)).where(inArray(contentMedia.contentId, ids));
  return new Map(rows.map(row => {
    const allowed = row.visibility === "public" ? row.body : truncateForPreview(row.body, row.previewMode, row.previewPercent, { mediaBlockWeight }).freeMarkdown;
    const folded = truncateForPreview(allowed, "percent", 100, { maxWeight: 900, maxBlocks: 6, mediaBlockWeight: 300 });
    const visible = new Set(folded.freeMediaIds);
    return [row.id, { bodyMarkdown: folded.freeMarkdown, collapsed: folded.hasPaidContent,
      media: media.filter(m => m.contentId === row.id && visible.has(m.mediaId)).map(({ contentId: _id, ...m }) => m) }];
  }));
}
