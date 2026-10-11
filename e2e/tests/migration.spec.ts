/**
 * 评审 P2 回归：0001 迁移（username → citext）在含大小写冲突的历史库上的行为。
 * 干净库迁移已由 global-setup 覆盖；本用例验证：
 * 1. 存在 Alice/alice 冲突时迁移失败，且整条迁移原子回滚（数据与 schema 保持一致）；
 * 2. 清理冲突后迁移可成功，citext 唯一约束生效。
 * 在独立临时数据库中执行，与主测试库完全隔离。
 */
import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { E2E, runId } from "../helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "packages/db/drizzle");
const MIGRATE_CLI = path.join(ROOT, "packages/db/src/migrate-cli.ts");
const TSX = path.join(ROOT, "node_modules/.bin/tsx");

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

/** 生产迁移入口（与 compose migrate 服务同一命令行）。 */
function runMigrateCli(dbName: string, migrationsFolder: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(TSX, [MIGRATE_CLI], {
      env: { ...process.env, DATABASE_URL: dbUrl(dbName), MIGRATIONS_FOLDER: migrationsFolder },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

/** 复制迁移目录到临时位置，并可只保留 0000（模拟"历史库只应用过 0000"）。 */
async function stageMigrations(dir: string, onlyFirst: boolean): Promise<string[]> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.cp(MIGRATIONS_DIR, dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  expect(files.length).toBeGreaterThanOrEqual(2);
  if (onlyFirst) {
    const journalPath = path.join(dir, "meta/_journal.json");
    const journal = JSON.parse(await fs.readFile(journalPath, "utf8"));
    journal.entries = journal.entries.slice(0, 1);
    await fs.writeFile(journalPath, JSON.stringify(journal, null, 2));
    for (const f of files.slice(1)) await fs.rm(path.join(dir, f));
  }
  return files;
}

test("citext 迁移遇历史大小写冲突：原子失败；清理冲突后成功", async () => {
  const dbName = `mig_${runId()}`.replace(/[^a-z0-9_]/gi, "_");  const admin = new pg.Client({ connectionString: dbUrl("postgres") });
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

/** 生产 Migrator（drizzle migrate-cli → runMigrations）的失败恢复：失败后重跑能正确收敛。 */
test("生产 Migrator：冲突失败不留下半截状态，清理后重跑恢复", async () => {
  const dbName = `mig2_${runId()}`.replace(/[^a-z0-9_]/gi, "_");
  const stageDir = path.join(ROOT, "e2e/.data", `migrations-${dbName}`);
  const admin = new pg.Client({ connectionString: dbUrl("postgres") });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const client = new pg.Client({ connectionString: dbUrl(dbName) });
  await client.connect();
  try {
    // 场景：历史库只应用过 0000（经生产 migrate-cli 应用，含 drizzle.__drizzle_migrations 记录）
    const files = await stageMigrations(stageDir, true);
    const first = await runMigrateCli(dbName, stageDir);
    expect(first.code, first.output).toBe(0);
    await client.query(
      `insert into users (email, username, password_hash) values ('a@example.com', 'Alice', 'x'), ('b@example.com', 'alice', 'x')`,
    );

    // 补齐 0001 后重跑生产迁移 → 唯一冲突失败
    await stageMigrations(stageDir, false);
    const failed = await runMigrateCli(dbName, stageDir);
    expect(failed.code, "冲突数据下迁移必须失败").not.toBe(0);
    expect(failed.output).toMatch(/unique|duplicate/i);

    // 失败原子性：迁移记录仍只有 0000，半截 DDL 不可见，数据完好
    const recorded = await client.query(`select count(*)::int as n from drizzle."__drizzle_migrations"`);
    expect(recorded.rows[0].n).toBe(1);
    const userType = await client.query(
      `select udt_name from information_schema.columns where table_name = 'users' and column_name = 'username'`,
    );
    expect(userType.rows[0]?.udt_name).toBe("text");
    expect((await client.query(`select count(*)::int as n from users`)).rows[0].n).toBe(2);

    // 清理冲突后重跑：恢复成功，迁移记录收敛为 2 条，citext 生效
    await client.query(`delete from users where username = 'alice'`);
    const recovered = await runMigrateCli(dbName, stageDir);
    expect(recovered.code, recovered.output).toBe(0);
    expect((await client.query(`select count(*)::int as n from drizzle."__drizzle_migrations"`)).rows[0].n).toBe(files.length);
    const after = await client.query(
      `select udt_name from information_schema.columns where table_name = 'users' and column_name = 'username'`,
    );
    expect(after.rows[0]?.udt_name).toBe("citext");

    // 收敛后重跑幂等（全部已应用，退出码 0）
    const noop = await runMigrateCli(dbName, stageDir);
    expect(noop.code, noop.output).toBe(0);
  } finally {
    await client.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});
