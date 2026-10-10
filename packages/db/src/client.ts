import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

/** 创建数据库连接池。应用（api/cli）各持有一份，退出时 close。 */
export function createDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * 为 advisory lock 准备的专用连接（ADR-0006 修订：锁生命周期由专用连接管理）。
 * 会话级 advisory lock 绑定连接，绝不能与连接池混用。
 */
export async function createLockClient(connectionString: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}

export { schema };
export * from "./schema";
