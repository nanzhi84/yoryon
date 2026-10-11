-- username 改为 citext（大小写不敏感唯一）；citext 扩展由 0000 创建
ALTER TABLE "contents" ALTER COLUMN "preview_mode" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE "citext";