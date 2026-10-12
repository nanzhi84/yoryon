/** playwright webServer 启动前的一次性构建（pretest）：web 需要生产构建。 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiEnv, webEnv, E2E } from "../helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "../..");

console.log("[setup] building web...");
// 静态生成必须有真实隔离数据源；上游失败绝不能写入成功空页。
execFileSync("docker", ["compose", "-f", path.join(ROOT, "e2e/docker-compose.e2e.yml"), "up", "-d", "--wait"], { stdio: "inherit" });
execFileSync(path.join(ROOT, "node_modules/.bin/tsx"), [path.join(ROOT, "packages/db/src/migrate-cli.ts")], { env: { ...process.env, DATABASE_URL: E2E.databaseUrl }, stdio: "inherit" });
const api = spawn(path.join(ROOT, "node_modules/.bin/tsx"), [path.join(ROOT, "apps/api/src/index.ts")], { env: { ...process.env, ...apiEnv() }, stdio: "ignore", detached: true });
try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (await fetch(`${E2E.apiUrl}/health`).then(r => r.ok, () => false)) break;
    if (Date.now() > deadline) throw new Error("build API unavailable");
    await new Promise(resolve => setTimeout(resolve, 200));
  }
// Data Cache 持久化在磁盘，跨运行残留陈旧响应——与 DB/存储一样在每次运行前清除
fs.rmSync(path.join(ROOT, "apps/web/.next/cache/fetch-cache"), { recursive: true, force: true });
execFileSync("npx", ["next", "build"], {
  cwd: path.join(ROOT, "apps/web"),
  env: { ...process.env, ...webEnv() } as NodeJS.ProcessEnv,
  stdio: "inherit",
});
console.log("[setup] web built");
} finally {
  if (api.pid) process.kill(-api.pid, "SIGTERM");
  await new Promise(resolve => api.on("exit", resolve));
}
