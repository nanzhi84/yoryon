CREATE TABLE "member_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month_key" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_xor" CHECK (("comments"."target_kind" = 'content' and "comments"."content_id" is not null and "comments"."question_id" is null) or ("comments"."target_kind" = 'question' and "comments"."question_id" is not null and "comments"."content_id" is null));