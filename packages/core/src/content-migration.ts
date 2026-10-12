/** 应用级数据迁移：数据库包只负责 SQL，公开正文投影使用生产同一 Markdown 规则。 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { contents, type Database } from "@yoryon/db";
import { truncateForPreview } from "./preview";
import { enqueueCacheEvent } from "./cache-events";

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
        const preview = row.visibility === "public" ? row.bodyMarkdown
          : truncateForPreview(body, row.previewMode, row.previewPercent, { mediaBlockWeight }).freeMarkdown;
        await tx.update(contents).set({ publicPreviewMarkdown: preview, previewRevision: row.revision })
          .where(and(eq(contents.id, row.id), eq(contents.revision, row.revision)));
      }
      // 同事务推进版本，保证回填后的 Feed 不复用迁移中空预览的缓存。
      await enqueueCacheEvent(tx, { tags: ["feed", "collections", "sitemap"], paths: ["/", "/c", "/sitemap.xml"] });
      return rows.length;
    });
    if (!count) return;
  }
}
