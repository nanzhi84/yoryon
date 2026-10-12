-- 归一既有微秒数据与 DB 写入精度；游标使用 JS Date 的毫秒全序。
ALTER TABLE "comments" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING date_trunc('milliseconds', "created_at");--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "created_at" SET DEFAULT date_trunc('milliseconds', now());--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING date_trunc('milliseconds', "created_at");--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT date_trunc('milliseconds', now());