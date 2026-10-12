/** 外部合同缺口：提交后进程退出、快速并发修改、旧事件乱序重放。 */
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { createPost } from "../helpers/fixtures";
import { runCliOk, runCli } from "../helpers/cli";
import { withDb } from "../helpers/api";
import { cliEnv, E2E, runId } from "../helpers/env";

test("真实 worker 提交后退出可恢复，并发修改及旧事件不会恢复旧正文", async ({ page, request }, info) => {
  test.setTimeout(180_000);
  const slug = `worker-${runId()}`;
  let entered!: () => void;
  const receiving = new Promise<void>(resolve => { entered = resolve; });
  const sockets = new Set<import("node:net").Socket>();
  const stalled = createServer((_req, _res) => { entered(); });
  stalled.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  stalled.listen(0, "127.0.0.1");
  await once(stalled, "listening");
  const port = (stalled.address() as import("node:net").AddressInfo).port;
  const dir = await createPost({ slug, body: "WORKER_COMMITTED_BODY" });
  const child = spawn(path.resolve("node_modules/.bin/tsx"), [path.resolve("../apps/cli/src/index.ts"), "publish", dir], {
    detached: true, stdio: "ignore", env: { ...process.env, ...cliEnv({ CACHE_REVALIDATE_URL: `http://127.0.0.1:${port}/api/revalidate` }) },
  });
  const exited = once(child, "close");
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([receiving, new Promise((_, reject) => { deadline = setTimeout(() => reject(Error("worker did not reach delivery")), 30_000); })]);
    clearTimeout(deadline);
    const committed = await withDb(async db => (await db.query("select body_markdown from contents where slug=$1", [slug])).rows[0]);
    expect(committed.body_markdown).toContain("WORKER_COMMITTED_BODY");
    process.kill(-child.pid!, "SIGTERM");
    await exited;
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid!, "SIGTERM");
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => stalled.close(() => resolve()));
  }
  const pending = await withDb(async db => (await db.query("select id,payload,state from cache_events where payload::jsonb->>'contentSlug'=$1 order by created_at desc limit 1", [slug])).rows[0]);
  expect(pending.state).toBe("pending");
  await runCliOk(["cache", "retry"]);
  await page.goto(`/p/${slug}`);
  await expect(page.getByText("WORKER_COMMITTED_BODY", { exact: true })).toBeVisible();
  const oldRevision = (await (await request.get(`/api/public/contents/${slug}`)).json()).revision;
  const first = await createPost({ slug, body: "CONCURRENT_BODY_ONE" });
  const saved = path.join(E2E.postsRoot, `${slug}-saved`);
  await fs.cp(first, saved, { recursive: true });
  const second = await createPost({ slug, body: "CONCURRENT_BODY_TWO" });
  const results = await Promise.all([runCli(["publish", saved]), runCli(["publish", second])]);
  expect(results.every(result => result.code === 0)).toBe(true);
  await runCliOk(["cache", "retry"]);
  const current = await withDb(async db => (await db.query("select body_markdown from contents where slug=$1", [slug])).rows[0]);
  expect(["CONCURRENT_BODY_ONE", "CONCURRENT_BODY_TWO"]).toContain(current.body_markdown.trim());
  const events = await withDb(async db => (await db.query("select payload from cache_events where payload::jsonb->>'contentSlug'=$1 order by created_at desc", [slug])).rows);
  for (const event of [...events, pending]) {
    const time = String(Date.now());
    const response = await request.post("/api/revalidate", { data: event.payload, headers: {
      "content-type": "application/json", "x-cache-time": time,
      "x-cache-signature": createHmac("sha256", "e2e-cache-secret-0123456789abcdef0123456789").update(`${time}.${event.payload}`).digest("hex"),
    } });
    expect(response.status()).toBe(200);
  }
  await page.reload();
  await expect(page.getByText(current.body_markdown.trim(), { exact: true })).toBeVisible();
  expect((await request.get(`/render/${oldRevision}/${slug}`)).status()).toBe(404);
  await runCliOk(["unpublish", slug]);
  for (const event of events) {
    const time = String(Date.now());
    await request.post("/api/revalidate", { data: event.payload, headers: { "content-type": "application/json", "x-cache-time": time, "x-cache-signature": createHmac("sha256", "e2e-cache-secret-0123456789abcdef0123456789").update(`${time}.${event.payload}`).digest("hex") } });
  }
  expect((await request.get(`/p/${slug}`)).status()).toBe(404);
  await info.attach("worker recovery and ordering", { body: JSON.stringify({ command: "pnpm e2e", environment: "isolated PG/FS, next start, TTL=86400", assertions: ["real process killed after DB commit before delivery", "durable retry visible in browser", "two concurrent CLI publications agree with latest DB body", "reverse-order duplicate event replay preserves latest revision", "old revision rejected", "old publication events cannot undo unpublish"] }), contentType: "application/json" });
});
