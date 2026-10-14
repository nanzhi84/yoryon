CREATE TABLE "content_likes" (
	"content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_likes_content_id_user_id_pk" PRIMARY KEY("content_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_likes_user_idx" ON "content_likes" USING btree ("user_id");