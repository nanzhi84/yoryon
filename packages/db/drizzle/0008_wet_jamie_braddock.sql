CREATE TABLE "comment_feed_versions" (
	"content_id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_feed_versions" ADD CONSTRAINT "comment_feed_versions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "comment_feed_versions" (content_id, version) SELECT DISTINCT content_id, 0 FROM "comments";
--> statement-breakpoint
CREATE FUNCTION bump_comment_feed(p_content_id uuid) RETURNS void LANGUAGE sql AS $$
  INSERT INTO comment_feed_versions (content_id, version)
  SELECT id, 1 FROM contents WHERE id = p_content_id
  ON CONFLICT (content_id) DO UPDATE SET version = comment_feed_versions.version + 1;
$$;
--> statement-breakpoint
CREATE FUNCTION track_comment_feed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NULL THEN PERFORM bump_comment_feed(NEW.content_id); END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- 作品级联删除时 contents 行已不可见，bump 不插入孤立的版本行。
    IF OLD.parent_id IS NULL THEN PERFORM bump_comment_feed(OLD.content_id); END IF;
  ELSIF ROW(NEW.like_count, NEW.created_at, NEW.id, NEW.deleted_at, NEW.parent_id, NEW.content_id)
      IS DISTINCT FROM ROW(OLD.like_count, OLD.created_at, OLD.id, OLD.deleted_at, OLD.parent_id, OLD.content_id) THEN
    IF OLD.parent_id IS NULL THEN PERFORM bump_comment_feed(OLD.content_id); END IF;
    IF NEW.parent_id IS NULL AND (OLD.parent_id IS NOT NULL OR NEW.content_id <> OLD.content_id) THEN
      PERFORM bump_comment_feed(NEW.content_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER comments_feed_version AFTER INSERT OR UPDATE OR DELETE ON "comments"
FOR EACH ROW EXECUTE FUNCTION track_comment_feed();
