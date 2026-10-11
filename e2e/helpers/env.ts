import fs from "node:fs";
/** E2E 环境常量（测试与进程启动共享）。 */
export const E2E = {
  apiPort: 4101,
  apiUrl: "http://localhost:4101",
  webPort: 3100,
  webUrl: "http://localhost:3100",
  caddyUrl: "http://localhost:4199",
  databaseUrl: "postgres://postgres:postgres@localhost:54329/yoryon_test",
  mailpitSmtpPort: 11125,
  mailpitApiUrl: "http://localhost:11126",
  bffSecret: "e2e-bff-secret-0123456789abcdef0123456789",
  fsSigningSecret: "e2e-fs-signing-secret-0123456789",
  storageRoot: new URL("../.data/storage", import.meta.url).pathname,
  postsRoot: new URL("../.data/posts", import.meta.url).pathname,
  assetsRoot: new URL("../.data/assets", import.meta.url).pathname,
  signalDir: new URL("../.data/signals", import.meta.url).pathname,
};

/** 本次运行的稳定标识（globalSetup 写入，worker 重载也不变） */
export function runId(): string {
  try {
    return fs.readFileSync(new URL("../.data/run-id", import.meta.url), "utf8").trim();
  } catch {
    return `norun-${process.pid}`;
  }
}

/** API 进程环境 */
export function apiEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PORT: String(E2E.apiPort),
    DATABASE_URL: E2E.databaseUrl,
    BFF_SHARED_SECRET: E2E.bffSecret,
    SITE_URL: E2E.webUrl,
    API_PUBLIC_URL: E2E.caddyUrl, // 签名 URL 经 Caddy（模拟生产拓扑）
    STORAGE_BACKEND: "fs",
    FS_STORAGE_ROOT: E2E.storageRoot,
    FS_STORAGE_SIGNING_SECRET: E2E.fsSigningSecret,
    MEDIA_SIGN_TTL: "900",
    MAIL_SMTP_HOST: "localhost",
    MAIL_SMTP_PORT: String(E2E.mailpitSmtpPort),
    MAIL_FROM: "Yoryon Test <test@example.com>",
    // 放大限流阈值，避免同一 IP（::1）上多个用例共享桶互相干扰；精确计数由限流用例按 scale 计算
    RATE_LIMIT_SCALE: "8",
  };
}

/** Web 进程环境 */
export function webEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    API_INTERNAL_URL: E2E.apiUrl,
    BFF_SHARED_SECRET: E2E.bffSecret,
    ALLOWED_ORIGINS: E2E.webUrl,
    SITE_URL: E2E.webUrl,
    // 缩短公开数据缓存窗口，保证 sitemap/标签页等 ISR 断言不受旧缓存干扰
    FEED_REVALIDATE_SEC: "1",
  };
}

/** CLI 进程环境 */
export function cliEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...apiEnv(),
    PORT: undefined,
    API_PUBLIC_URL: E2E.caddyUrl,
    ...extra,
  } as NodeJS.ProcessEnv;
}
