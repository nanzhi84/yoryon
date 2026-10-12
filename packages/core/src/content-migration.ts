/** 应用级数据迁移：数据库包只负责 SQL，公开正文投影使用生产同一 Markdown 规则。 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { contents, contentMedia, type Database } from "@yoryon/db";
import { truncateForPreview } from "./preview";
import { enqueueCacheEvent } from "./cache-events";
import { mediaIdFromUrl, parseMarkdown } from "./markdown";
import { visit } from "unist-util-visit";

export async function backfillContentPreviews(db: Database, mediaBlockWeight: number) {
  const exists = await db.execute(sql`select to_regclass('public.content_type_migration_backup') as name`);
  if (!exists.rows[0]?.name) return; // 未执行对应 SQL 迁移的旧版本数据库。
  for (;;) {
    const count = await db.transaction(async tx => {
      const rows = await tx.select().from(contents).where(isNull(contents.publicPreviewMarkdown)).limit(200).for("update");
      if (!rows.length) return 0;
      const backups = await tx.execute(sql`select content_id, original_row, converted_revision from content_type_migration_backup
        where content_id in (${sql.join(rows.map(r => sql`${r.id}::uuid`), sql`, `)})`);
      const source = new Map(backups.rows.map((r: any) => [r.content_id, r]));
      for (const row of rows) {
        const backup = source.get(row.id);
        const original = backup?.converted_revision === row.revision ? backup.original_row as Record<string, unknown> : null;
        const body = typeof original?.body_markdown === "string" ? original.body_markdown : row.bodyMarkdown;
        let migratedBody = row.bodyMarkdown;
        if (original && ["image", "video", "audio"].includes(String(original.type))) {
          const [primary] = await tx.select({ id: contentMedia.mediaId }).from(contentMedia)
            .where(eq(contentMedia.contentId, row.id)).orderBy(asc(contentMedia.position)).limit(1);
          if (!primary) throw new Error("Legacy content is missing its primary media");
          let present = false;
          visit(parseMarkdown(migratedBody), (node: any) => {
            const id = node.type === "image" ? mediaIdFromUrl(node.url)
              : node.type === "leafDirective" && ["video", "audio"].includes(node.name) ? mediaIdFromUrl(node.attributes?.src) : null;
            if (id === primary.id) present = true;
          });
          if (!present) {
            const src = `/api/media/${primary.id}`;
            const block = original.type === "image" ? `![作品图片](${src})` : `::${original.type}{src="${src}"}`;
            migratedBody = `${block}\n\n${migratedBody}`.trim();
          }
        }
        const preview = row.visibility === "public" ? migratedBody
          : truncateForPreview(body, row.previewMode, row.previewPercent, { mediaBlockWeight }).freeMarkdown;
        const revision = randomUUID();
        // null 阶段若曾生成空预览缓存，回填轮换门禁版本，旧 key 立即不可达。
        await tx.update(contents).set({ bodyMarkdown: migratedBody, publicPreviewMarkdown: preview, previewRevision: revision, revision, updatedAt: new Date() })
          .where(and(eq(contents.id, row.id), eq(contents.revision, row.revision)));
      }
      // 同事务推进版本，保证回填后的 Feed 不复用迁移中空预览的缓存。
      await enqueueCacheEvent(tx, { tags: ["feed", "collections", "sitemap"], paths: ["/", "/c", "/sitemap.xml"] });
      return rows.length;
    });
    if (!count) return;
  }
}
