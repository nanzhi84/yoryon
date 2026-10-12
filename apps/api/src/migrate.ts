/** 部署与本地迁移唯一入口：SQL 迁移后，持有发布锁回填派生公开投影。 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDb, createLockClient, runMigrations } from "@yoryon/db";
import { acquirePublishGcLock, backfillContentPreviews } from "@yoryon/core";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const mediaBlockWeight = Number(process.env.MEDIA_BLOCK_WEIGHT ?? 300);
if (!Number.isInteger(mediaBlockWeight) || mediaBlockWeight <= 0) throw new Error("MEDIA_BLOCK_WEIGHT must be a positive integer");
const folder = process.env.MIGRATIONS_FOLDER ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../packages/db/drizzle");
const client = await createLockClient(url);
const { db, close } = createDb(url);
let lock: Awaited<ReturnType<typeof acquirePublishGcLock>> | undefined;
try {
  await client.query("set statement_timeout = '60s'");
  lock = await acquirePublishGcLock(client, { blocking: true });
  await client.query("set statement_timeout = 0");
  await runMigrations(url, folder);
  await backfillContentPreviews(db, mediaBlockWeight);
  console.log("SQL migrations and public preview backfill applied");
} finally {
  try { await lock?.release(); }
  finally { await Promise.all([close(), client.end()]); }
}
