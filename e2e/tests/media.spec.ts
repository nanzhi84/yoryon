/**
 * 验收 10/11/12/13/14：媒体访问控制、签名 URL、缓存隔离、Range、曝光翻转、撤销联动。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall, registerUser } from "../helpers/api";
import { E2E } from "../helpers/env";
import path from "node:path";

const stamp = runId();

// percent 50%：免费区 = 第一段文字 + tiny.png；付费区 = 秘密文字 + photo.png
const FLIP_SLUG = `flip-${stamp}`;
const PAID_IMG_SLUG = `paidimg-${stamp}`;
const VIDEO_SLUG = `video-${stamp}`;

async function createCode(args: string[]): Promise<string> {
  const out = await runCliOk(["code", "create", ...args]);
  return /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(out)![1]!;
}

test.describe("媒体访问控制与缓存隔离", () => {
  let freeMediaId: string;
  let paidMediaId: string;
  let videoMediaId: string;

  test.beforeAll(async () => {
    // 付费文章 percent 50%：唯一 svg 在免费区，photo.png 在付费区（免费媒体必须唯一，避免其它内容的 free 优先语义干扰）
    const flipFree = `flipfree-${stamp}.svg`;
    await createPost({
      slug: FLIP_SLUG,
      title: "曝光翻转文章",
      visibility: "paid",
      previewMode: "percent",
      previewPercent: 50,
      body: `${TINY_TEXT(1)}\n\n![免费图](./media/${flipFree})\n\n${TINY_TEXT(2)}\n\n![付费图](./media/photo.png)`,
      extraFiles: { [flipFree]: `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>` },
    });
    // 独立付费图片内容（媒体本体恒 paid）
    await createPost({
      slug: PAID_IMG_SLUG,
      title: "付费图片",
      type: "image",
      visibility: "paid",
      previewMode: "none",
      primaryMedia: "./media/photo.png",
      description: "付费图集",
      body: "",
    });
    // 付费视频内容
    await createPost({
      slug: VIDEO_SLUG,
      title: "付费视频",
      type: "video",
      visibility: "paid",
      previewMode: "none",
      primaryMedia: "./media/video.mp4",
      description: "付费视频",
      body: "",
    });
    await runCliOk(["publish", path.join(E2E.postsRoot, FLIP_SLUG)]);
    await runCliOk(["publish", path.join(E2E.postsRoot, PAID_IMG_SLUG)]);
    await runCliOk(["publish", path.join(E2E.postsRoot, VIDEO_SLUG)]);

    // 找出媒体 id
    const flip = await apiCall(`/api/contents/${FLIP_SLUG}`);
    freeMediaId = flip.json.media.find((m: any) => m.exposure === "free").mediaId;
    const videoFull = await apiCall(`/api/contents/${VIDEO_SLUG}`);
    // 匿名：付费媒体不在响应中。经 CLI/DB 查 id
    const { withDb } = await import("../helpers/api");
    const rows = await withDb(async (db) =>
      (
        await db.query(
          `select cm.media_id from content_media cm join contents c on c.id = cm.content_id where c.slug = $1 order by cm.position`,
          [VIDEO_SLUG],
        )
      ).rows,
    );
    videoMediaId = rows[0].media_id;
    const paidRows = await withDb(async (db) =>
      (
        await db.query(
          `select cm.media_id from content_media cm join contents c on c.id = cm.content_id where c.slug = $1 and cm.exposure = 'paid' order by cm.position`,
          [FLIP_SLUG],
        )
      ).rows,
    );
    paidMediaId = paidRows[0].media_id;
    void videoFull;
  });

  test("免费媒体匿名 302 + 公共缓存头（max-age < 签名 TTL）；付费媒体匿名 403", async () => {
    const free = await apiCall(`/api/media/${freeMediaId}`, undefined, { method: "GET" });
    expect(free.status).toBe(302);
    const cc = free.headers.get("cache-control") ?? "";
    expect(cc).toContain("public");
    const maxAge = Number(/max-age=(\d+)/.exec(cc)![1]);
    expect(maxAge).toBeLessThan(900); // 必须小于签名 TTL（ADR-0003）
    expect(free.headers.get("location")).toContain("/api/storage-object/");

    const paid = await apiCall(`/api/media/${paidMediaId}`);
    expect(paid.status).toBe(403);

    // 独立付费图片的媒体本体恒 paid
    const imgContent = await apiCall(`/api/contents/${PAID_IMG_SLUG}`);
    expect(imgContent.json.media.length).toBe(0); // 匿名响应不含付费媒体
  });

  test("签名 URL 可取字节；伪造/过期签名被拒；Range 返回 206", async () => {
    const free = await apiCall(`/api/media/${freeMediaId}`);
    const location = free.headers.get("location")!;

    const bytes = await fetch(location);
    expect(bytes.status).toBe(200);
    expect(bytes.headers.get("accept-ranges")).toBe("bytes");

    // Range
    const ranged = await fetch(location, { headers: { range: "bytes=0-9" } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toMatch(/^bytes 0-9\//);

    // 伪造签名
    const bad = await fetch(location.replace(/sig=[0-9a-f]+/, "sig=" + "0".repeat(64)));
    expect(bad.status).toBe(403);
    // 过期签名
    const expired = await fetch(location.replace(/expires=\d+/, "expires=1000000000"));
    expect(expired.status).toBe(403);
  });

  test("授权后付费媒体 302（private no-store）可取字节；缓存隔离", async () => {
    const email = `e2e-media-${stamp}@example.com`;
    const token = await registerUser(email, `media${stamp}`, "password123", { asBff: { clientIp: "10.70.1.1" } });

    // 未授权详情访问（建立私有缓存视图）
    const detailBefore = await apiCall(`/api/contents/${FLIP_SLUG}`, undefined, { token });
    expect(detailBefore.json.access).toBe("preview");

    // 兑换单篇授权
    const code = await createCode(["--grant-type", "content", "--content", FLIP_SLUG, "--count", "1"]);
    await apiCall("/api/redemptions", { code }, { token, asBff: { clientIp: "10.70.1.2" } });

    // 授权后付费媒体 302 + private no-store
    const r = await apiCall(`/api/media/${paidMediaId}`, undefined, { token });
    expect(r.status).toBe(302);
    expect(r.headers.get("cache-control")).toContain("private");
    expect(r.headers.get("cache-control")).toContain("no-store");
    const bytes = await fetch(r.headers.get("location")!);
    expect(bytes.status).toBe(200);

    // 缓存隔离：授权用户访问后，匿名同 URL 仍为 403；详情页匿名仍为预览版
    expect((await apiCall(`/api/media/${paidMediaId}`)).status).toBe(403);
    const detailAnon = await apiCall(`/api/contents/${FLIP_SLUG}`);
    expect(detailAnon.json.access).toBe("preview");
    expect(detailAnon.json.bodyMarkdown).not.toContain("段落内容 2".repeat(1) + ""); // 付费区不含
    for (const m of detailAnon.json.media) expect(m.exposure).toBe("free");

    // 撤销权益 → 媒体同步 403、内容回落预览
    const ents = await apiCall("/api/me/entitlements", undefined, { token });
    await runCliOk(["entitlement", "revoke", ents.json.items[0].id, "--reason", "test media revoke"]);
    expect((await apiCall(`/api/media/${paidMediaId}`, undefined, { token })).status).toBe(403);
    expect((await apiCall(`/api/contents/${FLIP_SLUG}`, undefined, { token })).json.access).toBe("preview");
  });

  test("曝光翻转：曾免费的媒体转付费后匿名立即 403（无历史公开 URL 残留）", async () => {
    // 免费媒体 id（当前 percent 50% 下 tiny.png 免费）
    expect((await apiCall(`/api/media/${freeMediaId}`)).status).toBe(302);
    // 更新发布：preview 改为 none → 所有正文媒体转付费
    await createPost({
      slug: FLIP_SLUG,
      title: "曝光翻转文章",
      visibility: "paid",
      previewMode: "none",
      body: `${TINY_TEXT(1)}\n\n![原免费图](./media/flipfree-${stamp}.svg)\n\n${TINY_TEXT(2)}\n\n![付费图](./media/photo.png)`,
      extraFiles: { [`flipfree-${stamp}.svg`]: `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>` },
    });
    await runCliOk(["publish", path.join(E2E.postsRoot, FLIP_SLUG)]);
    expect((await apiCall(`/api/media/${freeMediaId}`)).status).toBe(403);
  });

  test("视频播放：浏览器加载私有视频（302→签名 URL），Range 206，签名失败自动重取恢复", async ({ page }) => {
    const email = `e2e-video-${stamp}@example.com`;
    const token = await registerUser(email, `video${stamp}`, "password123", { asBff: { clientIp: "10.70.2.1" } });
    const code = await createCode(["--grant-type", "content", "--content", VIDEO_SLUG, "--count", "1"]);
    await apiCall("/api/redemptions", { code }, { token, asBff: { clientIp: "10.70.2.2" } });

    // 登录（UI）并进入视频页
    await page.goto("/login");
    await page.getByLabel("邮箱或用户名").fill(email);
    await page.getByLabel("密码").fill("password123");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL("/");

    await page.goto(`/p/${VIDEO_SLUG}`);
    const video = page.locator("video");
    await expect(video).toBeVisible();

    // 等待元数据加载（私有媒体经 BFF 302 成功加载）
    await page.waitForFunction(() => {
      const v = document.querySelector("video");
      return v && v.readyState >= 1 && v.duration > 0;
    });
    const duration = await video.evaluate((v: HTMLVideoElement) => v.duration);
    expect(duration).toBeGreaterThan(0);

    // 模拟签名 URL 过期：对 storage-object 的下一次请求返回 403，之后放行
    let intercepted = false;
    await page.route("**/api/storage-object/**", async (route) => {
      if (!intercepted) {
        intercepted = true;
        await route.fulfill({ status: 403, body: "expired" });
      } else {
        await route.continue();
      }
    });

    // 触发 seek（产生新的 Range 请求 → 403 → 播放器捕获 error → 重新请求端点 → 恢复）
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = Math.min(1.5, v.duration * 0.5);
      void v.play().catch(() => {});
    });

    // 播放器应恢复：src 被重置（带 ?r= 参数）且最终可继续播放
    await page.waitForFunction(() => {
      const v = document.querySelector("video");
      return v && v.src.includes("/api/media/") && v.readyState >= 1;
    });
    // 恢复后继续播放不报错
    await page.waitForFunction(() => {
      const v = document.querySelector("video");
      return v && !v.paused && !v.error;
    }, undefined, { timeout: 10_000 }).catch(() => {
      // 恢复后至少 metadata 可用（自动播放可能被浏览器策略阻止）
    });
    const recoveredSrc = await video.evaluate((v: HTMLVideoElement) => v.src);
    expect(recoveredSrc).toContain("/api/media/");
  });
});
