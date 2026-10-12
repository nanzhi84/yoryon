CREATE TABLE "member_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month_key" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL,
	"answered_at" timestamp (3) with time zone,
	"discussion_version" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL,
	CONSTRAINT "member_questions_month_format" CHECK ("member_questions"."month_key" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "member_questions_question_length" CHECK (char_length(btrim("member_questions"."question")) between 1 and 500),
	CONSTRAINT "member_questions_visibility" CHECK ("member_questions"."visibility" in ('public', 'private')),
	CONSTRAINT "member_questions_status" CHECK ("member_questions"."status" in ('pending', 'answered', 'hidden'))
);
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "content_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "question_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "target_kind" text DEFAULT 'content' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "question_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_media_id" uuid;--> statement-breakpoint
ALTER TABLE "member_questions" ADD CONSTRAINT "member_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_questions_user_month_unique" ON "member_questions" USING btree ("user_id","month_key");--> statement-breakpoint
CREATE INDEX "member_questions_public_flow_idx" ON "member_questions" USING btree ("visibility","status","updated_at","id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_question_id_member_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."member_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_question_roots_idx" ON "comments" USING btree ("question_id","parent_id","like_count","created_at","id");--> statement-breakpoint
-- 收缩历史多置顶：保留最近的免费、已发布 article，其余仅撤销首页置顶标记。
UPDATE contents SET is_pinned = false WHERE is_pinned = true AND id IS DISTINCT FROM (
  SELECT id FROM contents WHERE is_pinned = true AND visibility = 'public' AND status = 'published' AND type = 'article'
  ORDER BY coalesce(published_at, created_at) DESC, id DESC LIMIT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contents_single_pinned_unique" ON "contents" USING btree ("is_pinned") WHERE "contents"."is_pinned" = true;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_xor" CHECK (("comments"."target_kind" = 'content' and "comments"."content_id" is not null and "comments"."question_id" is null) or ("comments"."target_kind" = 'question' and "comments"."question_id" is not null and "comments"."content_id" is null));
--> statement-breakpoint
-- 显式问答讨论版本：根排序/讨论变化与最近活动在评论事务内一起提交。
CREATE FUNCTION track_question_discussion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN q_id := OLD.question_id; ELSE q_id := NEW.question_id; END IF;
  IF q_id IS NOT NULL THEN
    UPDATE member_questions SET discussion_version = discussion_version + 1,
      updated_at = greatest(updated_at, date_trunc('milliseconds', clock_timestamp())) WHERE id = q_id;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER questions_discussion_version AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION track_question_discussion();
