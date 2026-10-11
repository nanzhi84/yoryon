/** PR 安全回归：真实 CLI → API/媒体，以及 SMTP → 并发验证。 */
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { createPost } from "../helpers/fixtures";
import { runCli, runCliOk } from "../helpers/cli";
import { apiCall } from "../helpers/api";
import { latestCodeFor } from "../helpers/mailpit";
import { E2E, runId } from "../helpers/env";

const stamp = runId();

test("付费省略预览默认关闭；显式 full 才能全文预览；缺失 marker 拒绝发布", async () => {
  const slug = `safe-preview-${stamp}`;
  const dir = await createPost({ slug, visibility: "paid", body: "PRIVATE_BODY" });
  const file = path.join(dir, "index.md");
  const original = await fs.readFile(file, "utf8");
  await fs.writeFile(file, original.replace(/^preview:.*\n/m, ""));
  await runCliOk(["publish", dir]);
  expect((await apiCall(`/api/contents/${slug}`)).json.bodyMarkdown).toBe("");
  await fs.writeFile(file, original);
  await runCliOk(["publish", dir]);
  expect((await apiCall(`/api/contents/${slug}`)).json.bodyMarkdown).toBe("PRIVATE_BODY");
  await fs.writeFile(file, original.replace("mode: full", "mode: marker"));
  const bad = await runCli(["publish", dir]);
  expect(bad.code).not.toBe(0);
  expect(bad.stdout + bad.stderr).toContain("marker");
  // 拒绝更新后旧版本不变。
  expect((await apiCall(`/api/contents/${slug}`)).json.bodyMarkdown).toBe("PRIVATE_BODY");
});

test("公开文章即使 preview none，正文图片仍可匿名读取", async ({ page }) => {
  const slug = `public-none-${stamp}`;
  const dir = await createPost({ slug, previewMode: "none", body: `![public](./media/unique.svg)`, extraFiles: { "unique.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><title>${slug}</title></svg>` } });
  await runCliOk(["publish", dir]);
  const detail = await apiCall(`/api/contents/${slug}`);
  expect(detail.json.media[0].exposure).toBe("free");
  expect((await apiCall(`/api/media/${detail.json.media[0].mediaId}`)).status).toBe(302);
  await page.goto(`/p/${slug}`);
  await expect.poll(() => page.locator('img[alt="public"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("并发错误验证码恰好允许 5 次；正确验证码只能成功消费一次", async () => {
  for (const variant of ["wrong", "right"] as const) {
    const email = `race-${variant}-${stamp}@example.com`;
    expect((await apiCall("/api/auth/register", { email, username: `race${variant}${stamp}`, password: "password123" })).status).toBe(200);
    const correct = await latestCodeFor(email);
    const code = variant === "right" ? correct : correct === "000000" ? "111111" : "000000";
    const results = await Promise.all(Array.from({ length: 10 }, () => apiCall("/api/auth/verify-email", { email, code })));
    if (variant === "wrong") {
      expect(results.filter(r => r.status === 400)).toHaveLength(5);
      expect(results.filter(r => r.status === 429)).toHaveLength(5);
      expect((await apiCall("/api/auth/verify-email", { email, code: correct })).status).toBe(429);
    } else {
      expect(results.filter(r => r.status === 200)).toHaveLength(1);
      expect(results.filter(r => r.status === 400)).toHaveLength(9);
    }
  }
});

test("用户名大小写变体不能重复注册", async () => {
  const username = `Case${stamp}`;
  const register = (suffix: string, name: string) => apiCall("/api/auth/register", { email: `case-${suffix}-${stamp}@example.com`, username: name, password: "password123" });
  expect((await register("first", username)).status).toBe(200);
  expect((await register("second", username.toLowerCase())).status).toBe(409);
});

test("BFF 写请求缺少 Origin 和 Fetch Metadata 时拒绝", async ({ request }) => {
  const res = await request.post(`${E2E.webUrl}/api/auth/logout`);
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("csrf_rejected");
});

test("百分比预览能截断单个长文本段而不泄露段尾", async () => {
  const slug = `long-preview-${stamp}`;
  const dir = await createPost({ slug, visibility: "paid", previewMode: "percent", previewPercent: 30, body: "A".repeat(1000) + "SECRET_END" });
  await runCliOk(["publish", dir]);
  const detail = await apiCall(`/api/contents/${slug}`);
  expect(detail.json.bodyMarkdown.length).toBeGreaterThanOrEqual(300);
  expect(detail.json.bodyMarkdown.length).toBeLessThanOrEqual(310);
  expect(detail.json.bodyMarkdown).not.toContain("SECRET_END");
});
