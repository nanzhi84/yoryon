import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { E2E, runId } from "../helpers/env";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { withDb } from "../helpers/api";
import { createHmac } from "node:crypto";

test("静态公开正文与撤销：旧 revision、RSC、匿名私有请求及重新发布", async ({ page, request }, info) => {
  test.setTimeout(120_000);
  const slug = `static-${runId()}`;
  const secret = "SYNTHETIC_PUBLIC_THEN_PAID_FULL_TEXT";
  let dir = await createPost({ slug, body: `免费导言。\n\n<!-- more -->\n\n${secret}`, previewMode: "marker" });
  await runCliOk(["publish", dir]);
  const before = await request.get(`/api/public/contents/${slug}`);
  expect(before.status()).toBe(200);
  const old = await before.json();
  const bodyCalls = async () => (await fs.readFile(new URL("../.data/api.log", import.meta.url), "utf8")).split("\n").filter(line => line.includes(`"path":"/api/public/contents/${slug}"`)).length;
  const bodyCallsBefore = await bodyCalls();
  let privateCalls = 0;
  page.on("request", req => { if (new URL(req.url()).pathname === `/api/contents/${slug}`) privateCalls++; });
  await page.goto(`/p/${slug}`);
  await expect(page.getByText(secret, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(secret, { exact: true })).toBeVisible();
  expect(privateCalls).toBe(0);
  expect(await bodyCalls()).toBe(bodyCallsBefore);
  dir = await createPost({ slug, visibility: "paid", previewMode: "marker", body: `免费导言。\n\n<!-- more -->\n\n${secret}` });
  await runCliOk(["publish", dir]);
  const html = await (await request.get(`/p/${slug}`)).text();
  expect(html).not.toContain(secret);
  const oldRoute = await request.get(`/render/${old.revision}/${slug}`);
  expect(await oldRoute.text()).not.toContain(secret);
  const rsc = await request.get(`/p/${slug}?_rsc=acceptance`, { headers: { RSC: "1" } });
  expect(await rsc.text()).not.toContain(secret);
  expect(await (await request.get(`/api/public/contents/${slug}`)).text()).not.toContain(secret);
  await page.reload();
  await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  await expect(page.getByText("本内容为订阅专享，以上为免费预览。")).toBeVisible();
  await runCliOk(["unpublish", slug]);
  expect((await request.get(`/p/${slug}`)).status()).toBe(404);
  expect((await request.get(`/render/${old.revision}/${slug}`)).status()).toBe(404);
  dir = await createPost({ slug, body: "重新公开的完整正文。" });
  await runCliOk(["publish", dir]);
  await page.goto(`/p/${slug}`);
  await expect(page.getByText("重新公开的完整正文。", { exact: true })).toBeVisible();
  await info.attach("public cache acceptance", { body: JSON.stringify({ environment: E2E.webUrl, ttl: 86400, warmReadsAddedBodyApiCalls: 0, publicPrivateCallsBeforeConversion: 0, assertions: ["anonymous static body", "old revision blocked", "HTML RSC public JSON isolation", "unpublish", "republish"] }), contentType: "application/json" });
});

test("真实 API 故障门禁关闭；恢复后缓存可读；签名过期及事件重放", async ({ request }, info) => {
  test.setTimeout(90_000);
  const slug = `gate-failure-${runId()}`;
  await runCliOk(["publish", await createPost({ slug, body: "SYNTHETIC_GATE_FAILURE_BODY" })]);
  expect((await request.get(`/p/${slug}`)).status()).toBe(200);
  const pid = Number(execFileSync("lsof", ["-t", `-iTCP:${E2E.apiPort}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim());
  expect(Number.isSafeInteger(pid) && pid > 1).toBe(true);
  process.kill(pid, "SIGSTOP");
  try {
    const unavailable = await request.get(`/p/${slug}`);
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.text()).not.toContain("SYNTHETIC_GATE_FAILURE_BODY");
    expect((await request.get("/")).status()).toBe(200); // 上次成功的公开列表未被写成空页。
  } finally { process.kill(pid, "SIGCONT"); }
  expect((await request.get(`/p/${slug}`)).status()).toBe(200);
  const row = await withDb(async db => (await db.query("select payload from cache_events where payload::jsonb->>'contentSlug'=$1 order by created_at desc limit 1", [slug])).rows[0]);
  const send = (time: string) => request.post("/api/revalidate", { data: row.payload, headers: { "content-type": "application/json", "x-cache-time": time, "x-cache-signature": createHmac("sha256", "e2e-cache-secret-0123456789abcdef0123456789").update(`${time}.${row.payload}`).digest("hex") } });
  expect((await send(String(Date.now() - 120_000))).status()).toBe(403);
  expect((await send(String(Date.now()))).status()).toBe(200);
  expect((await send(String(Date.now()))).status()).toBe(200);
  expect((await request.get(`/p/${slug}`)).status()).toBe(200);
  await info.attach("gate failure and replay", { body: JSON.stringify({ assertions: ["real API SIGSTOP: 503 without cached body", "cached list preserved", "SIGCONT recovery", "expired signature rejected", "durable verified event replay idempotent"] }), contentType: "application/json" });
});
