/**
 * F08：图片尺寸元数据链路（性能批次一）。
 * - 发布链路探测图片尺寸写入 media_assets.width/height，详情 API 返回真实尺寸；
 * - 图集详情 img 以真实 width/height 预留空间、非首张 lazy；正文图片消费同一尺寸元数据；
 * - 旧素材补刷：blog media probe-dimensions（dry-run / --apply）。
 */
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall, withDb } from "../helpers/api";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const SLUG = `dims-${stamp}`;
const SVG_NAME = `dimscover-${stamp}.svg`;
const PNG_NAME = `dimsphoto-${stamp}.png`;
/** 生成的 7x3 PNG（独立字节，不复用共享资产——公开内容的 free 曝光会抬升同字节资产的曝光，干扰其它用例） */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAAJUlEQVR4nGNgYGRiZmFlY+fg5OLm4eXjFxAUEhbBKijKgE1QDABM9QK2nKFhMgAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeAll(async () => {
  const dir = await createPost({
    slug: SLUG,
    title: "尺寸图集",
    type: "image",
    visibility: "public",
    previewMode: "full",
    primaryMedia: `./media/${PNG_NAME}`, // 7x3
    cover: `./media/${SVG_NAME}`, // 64x64
    body: `正文图片\n\n![正文图](./media/${PNG_NAME})`,
    extraFiles: {
      [PNG_NAME]: PNG_BYTES,
      [SVG_NAME]: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>`,
    },
  });
  await runCliOk(["publish", dir]);
});

test("发布探测尺寸：详情 API 返回真实 width/height（含 SVG 封面）", async () => {
  const detail = await apiCall(`/api/contents/${SLUG}`);
  expect(detail.status).toBe(200);
  const png = detail.json.media.find((m: any) => m.mimeType === "image/png");
  expect(png).toBeTruthy();
  expect(png.width).toBe(7);
  expect(png.height).toBe(3);

  // SVG 封面同样入库探测（封面不在 content_media，经 contents.cover_media_id 直查）
  const svgDims = await withDb(async (db) => {
    const r = await db.query(`select m.width, m.height from media_assets m join contents c on c.cover_media_id = m.id where c.slug = $1`, [SLUG]);
    return r.rows[0] as { width: number; height: number } | undefined;
  });
  expect(svgDims).toEqual({ width: 64, height: 64 });
});

test("图集与正文图片以 width/height 预留空间，非首张 lazy", async ({ page }) => {
  await page.goto(`/p/${SLUG}`);
  const galleryImg = page.locator("main img").first();
  await expect(galleryImg).toHaveAttribute("width", "7");
  await expect(galleryImg).toHaveAttribute("height", "3");
  // 正文图片消费同一尺寸元数据
  const bodyImg = page.locator(".prose img").first();
  await expect(bodyImg).toHaveAttribute("width", "7");
  await expect(bodyImg).toHaveAttribute("height", "3");
  await expect(bodyImg).toHaveAttribute("loading", "lazy");
});

test("旧素材补刷：media probe-dimensions 回填缺失尺寸（dry-run 不写库）", async () => {
  // 抹掉已入库尺寸，模拟历史旧素材
  await withDb(async (db) => {
    await db.query(`update media_assets set width = null, height = null where mime_type like 'image/%'`);
  });

  // dry-run：只统计不写库（本用例资产仍在缺尺寸集合中）
  const dry = await runCliOk(["media", "probe-dimensions"]);
  expect(dry).toContain("dry-run");
  const ownDims = () =>
    withDb(async (db) => {
      const r = await db.query(
        `select m.width, m.height from media_assets m
         join content_media cm on cm.media_id = m.id join contents c on c.id = cm.content_id
         where c.slug = $1 and m.mime_type = 'image/png'`,
        [SLUG],
      );
      return r.rows[0] as { width: number | null; height: number | null } | undefined;
    });
  expect((await ownDims())?.width).toBeNull();

  // apply：回填（对象缺失/探测失败不阻断，可重跑）
  await runCliOk(["media", "probe-dimensions", "--apply"]);
  expect(await ownDims()).toEqual({ width: 7, height: 3 });

  // 补刷后详情 API 恢复真实尺寸
  const detail = await apiCall(`/api/contents/${SLUG}`);
  const png = detail.json.media.find((m: any) => m.mimeType === "image/png");
  expect([png.width, png.height]).toEqual([7, 3]);
});
