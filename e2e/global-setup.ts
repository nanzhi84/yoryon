/**
 * E2E 前置：启动 docker compose（postgres/mailpit/caddy），重置数据库并迁移，
 * 生成媒体资产（ffmpeg），构建 web（next build 需要环境变量而非运行中的 API）。
 */
import { execFileSync, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { E2E } from "./helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "..");

async function waitFor(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

export default async function globalSetup() {
  fs.writeFileSync(path.join(__dirname, ".data/run-id"), String(Date.now()));
  fs.rmSync(E2E.storageRoot, { recursive: true, force: true });
  fs.rmSync(E2E.postsRoot, { recursive: true, force: true });
  fs.rmSync(E2E.signalDir, { recursive: true, force: true });
  fs.mkdirSync(E2E.storageRoot, { recursive: true });
  fs.mkdirSync(E2E.postsRoot, { recursive: true });
  fs.mkdirSync(E2E.assetsRoot, { recursive: true });
  fs.mkdirSync(E2E.signalDir, { recursive: true });

  // 1. 依赖容器
  execFileSync("docker", ["compose", "-f", path.join(__dirname, "docker-compose.e2e.yml"), "up", "-d", "--wait"], {
    stdio: "inherit",
  });

  // 2. 重置数据库（drop schema）+ 迁移
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  await client.query("drop schema public cascade; create schema public; drop schema if exists drizzle cascade;");
  await client.end();
  execFileSync(path.join(ROOT, "node_modules/.bin/tsx"), [path.join(ROOT, "packages/db/src/migrate-cli.ts")], {
    env: { ...process.env, DATABASE_URL: E2E.databaseUrl },
    stdio: "inherit",
  });

  // 3. 媒体资产（幂等生成）
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const assets: [string, () => Promise<void>][] = [
    ["tiny.png", async () => fs.promises.writeFile(path.join(E2E.assetsRoot, "tiny.png"), png1x1)],
    [
      "photo.png",
      () =>
        execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=640x360:rate=1", "-frames:v", "1", path.join(E2E.assetsRoot, "photo.png")]).then(() => {}),
    ],
    [
      "video.mp4",
      () =>
        execFileAsync("ffmpeg", [
          "-y", "-f", "lavfi", "-i", "testsrc=duration=4:size=640x360:rate=15",
          "-pix_fmt", "yuv420p", "-vcodec", "libx264", path.join(E2E.assetsRoot, "video.mp4"),
        ]).then(() => {}),
    ],
    [
      "audio.mp3",
      () =>
        execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", path.join(E2E.assetsRoot, "audio.mp3")]).then(() => {}),
    ],
  ];
  for (const [name, gen] of assets) {
    const p = path.join(E2E.assetsRoot, name);
    if (!fs.existsSync(p)) {
      await gen();
      console.log(`[setup] generated ${name}`);
    }
  }

  // 4. 清空 mailpit
  await fetch(`${E2E.mailpitApiUrl}/api/v1/messages`, { method: "DELETE" }).catch(() => {});

  // 5. 等 web/api 就绪（由 playwright webServer 启动）
  await waitFor(`${E2E.apiUrl}/health`);
  await waitFor(`${E2E.webUrl}/login`);
  console.log("[setup] ready");
}
