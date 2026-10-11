/**
 * 评审 P2 回归：0001 迁移（username → citext）在含大小写冲突的历史库上的行为。
 * 干净库迁移已由 global-setup 覆盖；本用例验证：
 * 1. 存在 Alice/alice 冲突时迁移失败，且整条迁移原子回滚（数据与 schema 保持一致）；
 * 2. 清理冲突后迁移可成功，citext 唯一约束生效。
 * 在独立临时数据库中执行，与主测试库完全隔离。
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { E2E, runId } from "../helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../packages/db/drizzle");

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

function dbUrl(name: string): string {
  const url = new URL(E2E.databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

test("citext 迁移遇历史大小写冲突：原子失败；清理冲突后成功", async () => {
  const dbName = `mig_${runId()}`.replace(/[^a-z0-9_]/gi, "_");
  const admin = new pg.Client({ connectionString: dbUrl("postgres") });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const client = new pg.Client({ connectionString: dbUrl(dbName) });
  await client.connect();
  try {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThanOrEqual(2);
    const mig0000 = splitStatements(await fs.readFile(path.join(MIGRATIONS_DIR, files[0]!), "utf8"));
    const mig0001 = splitStatements(await fs.readFile(path.join(MIGRATIONS_DIR, files[1]!), "utf8"));

    // 历史 schema（username text，唯一索引大小写敏感）
    for (const stmt of mig0000) await client.query(stmt);
    // 历史数据：仅大小写不同的两个用户名（旧 schema 下合法）
    await client.query(
      `insert into users (email, username, password_hash) values ('a@example.com', 'Alice', 'x'), ('b@example.com', 'alice', 'x')`,
    );

    // 整条迁移包在单事务中执行（与 drizzle migrator 行为一致）→ 应失败并回滚
    let migrated = false;
    try {
      await client.query("BEGIN");
      for (const stmt of mig0001) await client.query(stmt);
      await client.query("COMMIT");
      migrated = true;
    } catch {
      await client.query("ROLLBACK");
    }
    expect(migrated, "存在大小写冲突时 0001 迁移必须失败").toBe(false);

    // 原子性：迁移内第一条 ALTER（preview_mode 默认值）也随回滚恢复原状
    const col = await client.query(
      `select column_default from information_schema.columns where table_name = 'contents' and column_name = 'preview_mode'`,
    );
    expect(col.rows[0]?.column_default).toBe("'full'::text");
    const userType = await client.query(
      `select udt_name from information_schema.columns where table_name = 'users' and column_name = 'username'`,
    );
    expect(userType.rows[0]?.udt_name).toBe("text");
    const users = await client.query(`select username from users order by email`);
    expect(users.rows.map((r) => r.username)).toEqual(["Alice", "alice"]);

    // 清理冲突（升级前置步骤）后迁移成功，citext 唯一约束生效
    await client.query(`delete from users where username = 'alice'`);
    for (const stmt of mig0001) await client.query(stmt);
    const after = await client.query(
      `select udt_name from information_schema.columns where table_name = 'users' and column_name = 'username'`,
    );
    expect(after.rows[0]?.udt_name).toBe("citext");
    await expect(
      client.query(`insert into users (email, username, password_hash) values ('c@example.com', 'ALICE', 'x')`),
    ).rejects.toThrow(/unique/i);
  } finally {
    await client.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
  }
});
