import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** 执行迁移。迁移使用独立连接（生产环境应使用 migrator 专用账号，ADR §12 凭证分离）。 */
export async function runMigrations(connectionString: string, migrationsFolder: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
