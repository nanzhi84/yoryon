CREATE TABLE "content_references" (
	"content_id" uuid NOT NULL,
	"referenced_id" uuid NOT NULL,
	"target_id" uuid,
	CONSTRAINT "content_references_content_id_referenced_id_pk" PRIMARY KEY("content_id","referenced_id"),
	CONSTRAINT "content_references_no_self" CHECK ("content_references"."content_id" <> "content_references"."referenced_id")
);
--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "public_preview_markdown" text;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "preview_revision" uuid;--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_target_id_contents_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_references_target_idx" ON "content_references" USING btree ("referenced_id");--> statement-breakpoint
-- 数据恢复快照仅由应用迁移读取，不参与运行态作品关联或 GC。
CREATE TABLE "content_type_migration_backup" (
  "content_id" uuid PRIMARY KEY,
  "original_row" jsonb NOT NULL,
  "converted_revision" uuid NOT NULL,
  "migrated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM contents c WHERE c.type IN ('image','video','audio')
    AND NOT EXISTS (SELECT 1 FROM content_media cm WHERE cm.content_id = c.id)
  ) THEN RAISE EXCEPTION 'Legacy content is missing its primary media; migration aborted'; END IF;
END $$;
--> statement-breakpoint
INSERT INTO content_type_migration_backup (content_id, original_row, converted_revision)
SELECT c.id, to_jsonb(c), gen_random_uuid() FROM contents c WHERE c.type IN ('image','video','audio');
--> statement-breakpoint
-- 主媒体注入和旧付费预览保真由持发布锁的应用 migrator 使用真实 Markdown AST 完成。
UPDATE contents c SET type = 'post', revision = b.converted_revision, updated_at = now()
FROM content_type_migration_backup b WHERE c.id = b.content_id;
--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_type_check" CHECK ("contents"."type" in ('article', 'post'));--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_article_title_check" CHECK ("contents"."type" <> 'article' or length(trim("contents"."title")) > 0);
