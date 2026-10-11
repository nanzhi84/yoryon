import { defineConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { apiEnv, webEnv, E2E } from "./helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(__dirname, ".data"), { recursive: true });

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // 限流/锁等全局状态要求串行（ADR：E2E 走真实路径，不用 mock 隔离）
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: E2E.webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `npx tsx apps/api/src/index.ts > e2e/.data/api.log 2>&1`,
      cwd: ROOT,
      env: { ...process.env, ...apiEnv() } as Record<string, string>,
      port: E2E.apiPort,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${E2E.webPort} > ../../e2e/.data/web.log 2>&1`,
      cwd: path.join(ROOT, "apps/web"),
      env: { ...process.env, ...webEnv() } as Record<string, string>,
      port: E2E.webPort,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
