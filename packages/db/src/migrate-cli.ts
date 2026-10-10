/** CLI 入口：pnpm --filter @yoryon/db migrate（DATABASE_URL 经环境变量注入） */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runMigrations } from "./migrate";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

await runMigrations(connectionString, migrationsFolder);
console.log("migrations applied");
