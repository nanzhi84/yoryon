/** 部署与本地迁移唯一入口：SQL 迁移后，持有发布锁回填派生公开投影。 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDb, createLockClient, runMigrations } from "@yoryon/db";
import { acquirePublishGcLock, backfillContentPreviews } from "@yoryon/core";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const folder = process.env.MIGRATIONS_FOLDER ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../packages/db/drizzle");
const client = await createLockClient(url);
const lock = await acquirePublishGcLock(client, { blocking: true });
const { db, close } = createDb(url);
try {
  await runMigrations(url, folder);
  await backfillContentPreviews(db, Number(process.env.MEDIA_BLOCK_WEIGHT ?? 300));
  console.log("SQL migrations and public preview backfill applied");
} finally { await close(); await lock.release(); await client.end(); }
