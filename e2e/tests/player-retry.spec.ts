/**
 * F06：播放器有界重试（性能批次一）。
 * 媒体端点持续失败时：自动重签名刷新最多 1 次后停止（端点请求数封顶，不再无限循环），
 * 展示手动重试入口；点击重试后才发起新一轮请求。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const SLUG = `player-retry-${stamp}`;
const VIDEO_NAME = `retryvideo-${stamp}.mp4`;

test.beforeAll(async () => {
  // 追加 runId 字节使内容寻址 key 唯一（公开内容的 free 曝光会抬升同字节资产，不复用共享 video.mp4）
  const videoBytes = await fs.readFile(path.join(E2E.assetsRoot, "video.mp4"));
  const dir = await createPost({
    slug: SLUG,
    title: "播放器重试边界",
    type: "video",
    visibility: "public",
    previewMode: "full",
    primaryMedia: `./media/${VIDEO_NAME}`,
    description: "持续失败下的重试上限",
    body: "",
    extraFiles: { [VIDEO_NAME]: Buffer.concat([videoBytes, Buffer.from(String(stamp))]) },
  });
  await runCliOk(["publish", dir]);
});

test("媒体持续失败：自动重试最多 1 次后停止，手动重试才再请求", async ({ page }) => {
  let mediaRequests = 0;
  await page.route("**/api/media/*", async (route) => {
    mediaRequests += 1;
    await route.abort();
  });

  await page.goto(`/p/${SLUG}`);

  // 自动重试上限 1：初始加载 + 1 次自动重试 = 恰好 2 次端点请求（等值断言同时排除
  // “同一失败被重复通知→提前 failed、实际自动重试未发生”的少发情况），随后停止并展示手动重试
  await expect(page.getByText("媒体加载失败")).toBeVisible({ timeout: 20_000 });
  expect(mediaRequests).toBe(2);

  // 停止后不再产生新的端点请求（无后台轮询/无限循环）
  await page.waitForTimeout(3_000);
  expect(mediaRequests).toBe(2);

  // 手动重试才发起新一轮请求
  await page.getByRole("button", { name: "重试" }).click();
  await expect
    .poll(() => mediaRequests, { timeout: 10_000 })
    .toBe(3);
  await expect(page.getByText("媒体加载失败")).toBeVisible({ timeout: 20_000 });
});
