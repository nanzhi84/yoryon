/**
 * F08：图片尺寸元数据链路（性能批次一）。
 * - 发布链路探测图片尺寸写入 media_assets.width/height，详情 API 返回真实尺寸；
 *   EXIF orientation 5-8 交换宽高（旋转照片按展示方向预留空间）；
 * - 图集详情 img 以真实 width/height 预留空间、首张 eager 非首张 lazy；正文图片消费同一尺寸元数据；
 * - 旧素材补刷：blog media probe-dimensions（dry-run / --apply）。
 * 数据隔离：全部媒体字节为本用例独有（内容寻址下复用共享字节会互相抬升曝光/尺寸断言）。
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
const PNG1_NAME = `dimsphoto1-${stamp}.png`;
const PNG2_NAME = `dimsphoto2-${stamp}.png`;
const JPG_NAME = `dimsrotated-${stamp}.jpg`;
/** 生成的 7x3 PNG */
const PNG1_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAAJUlEQVR4nGNgYGRiZmFlY+fg5OLm4eXjFxAUEhbBKijKgE1QDABM9QK2nKFhMgAAAABJRU5ErkJggg==",
  "base64",
);
/** 生成的 5x4 PNG（字节独立于 PNG1） */
const PNG2_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAECAIAAADJUWIXAAAASElEQVR4nGNgYOcTlVHWMrSwd/MNiU5i4BWRVtI0MLdz9QmOSszIZ5BS1NA3s3XxDopMSM8rrWFQ1zO1cfYKjIhPyy2pbuoEAKZ/EA/0A9neAAAAAElFTkSuQmCC",
  "base64",
);
/** 最小 JPEG：原始像素 100x50 + EXIF orientation=6（旋转 90°）→ 展示尺寸应为 50x100 */
const JPG_ROTATED_BYTES = Buffer.from(
  "/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/wAARCAAyAGQDAAAAAAAAAAAA/9k=",
  "base64",
);

test.beforeAll(async () => {
  const dir = await createPost({
    slug: SLUG,
    title: "尺寸图集",
    type: "image",
    visibility: "public",
    previewMode: "full",
    primaryMedia: `./media/${PNG1_NAME}`, // 7x3
    cover: `./media/${SVG_NAME}`, // 64x64（字节含 stamp，独占资产）
    body: `正文图片\n\n![正文图一](./media/${PNG2_NAME})\n\n![正文图二](./media/${JPG_NAME})`,
    extraFiles: {
      [PNG1_NAME]: PNG1_BYTES,
      [PNG2_NAME]: PNG2_BYTES,
      [JPG_NAME]: JPG_ROTATED_BYTES,
      [SVG_NAME]: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><!-- ${stamp} --></svg>`,
    },
  });
  await runCliOk(["publish", dir]);
});

/** 本用例拥有的媒体资产（正文/主媒体 + 封面），补刷用例的 DB 修改仅限此范围 */
async function ownImageDims(): Promise<{ oss_key: string; width: number | null; height: number | null }[]> {
  return withDb(async (db) => {
    const r = await db.query(
      `select m.oss_key, m.width, m.height from media_assets m
       where m.id in (
         select cm.media_id from content_media cm join contents c on c.id = cm.content_id where c.slug = $1
         union
         select cover_media_id from contents where slug = $1 and cover_media_id is not null
       ) and m.mime_type like 'image/%'`,
      [SLUG],
    );
    return r.rows;
  });
}

test("发布探测尺寸：详情 API 返回真实 width/height（PNG/SVG/EXIF 旋转 JPEG）", async () => {
  const detail = await apiCall(`/api/contents/${SLUG}`);
  expect(detail.status).toBe(200);
  const dims = await ownImageDims();
  // 详情 API：图集媒体尺寸（含 EXIF 旋转交换宽高）
  const media = detail.json.media as any[];
  expect(media.length).toBe(3);
  expect([media[0].width, media[0].height]).toEqual([7, 3]); // 主媒体 PNG1
  expect([media[1].width, media[1].height]).toEqual([5, 4]); // 正文 PNG2
  expect([media[2].width, media[2].height]).toEqual([50, 100]); // 旋转 JPEG：100x50 + orientation 6 → 50x100

  // SVG 封面同样入库探测（封面不在 content_media，经 contents.cover_media_id 直查）
  const svg = dims.find((d) => d.oss_key.endsWith(".svg"));
  expect(svg && [svg.width, svg.height]).toEqual([64, 64]);
});

test("图集与正文图片以 width/height 预留空间，首张 eager、非首张 lazy", async ({ page }) => {
  await page.goto(`/p/${SLUG}`);
  // 图集三张：第一张 eager，其余 lazy
  const galleryImgs = page.locator("main img:not(.prose img)");
  await expect(galleryImgs).toHaveCount(3);
  await expect(galleryImgs.nth(0)).toHaveAttribute("width", "7");
  await expect(galleryImgs.nth(0)).toHaveAttribute("height", "3");
  await expect(galleryImgs.nth(0)).toHaveAttribute("loading", "eager");
  await expect(galleryImgs.nth(1)).toHaveAttribute("loading", "lazy");
  await expect(galleryImgs.nth(2)).toHaveAttribute("loading", "lazy");
  // 正文图片消费同一尺寸元数据（含旋转 JPEG 交换后尺寸）
  const bodyImgs = page.locator(".prose img");
  await expect(bodyImgs).toHaveCount(2);
  await expect(bodyImgs.nth(0)).toHaveAttribute("width", "5");
  await expect(bodyImgs.nth(0)).toHaveAttribute("height", "4");
  await expect(bodyImgs.nth(0)).toHaveAttribute("loading", "lazy");
  await expect(bodyImgs.nth(1)).toHaveAttribute("width", "50");
  await expect(bodyImgs.nth(1)).toHaveAttribute("height", "100");
});

test("旧素材补刷：media probe-dimensions 回填缺失尺寸（dry-run 不写库）", async () => {
  // 抹掉本用例资产的已入库尺寸，模拟历史旧素材（仅限本用例拥有的媒体，不动其它用例数据）
  const before = await ownImageDims();
  expect(before.length).toBe(4);
  await withDb(async (db) => {
    await db.query(
      `update media_assets set width = null, height = null
       where id in (
         select cm.media_id from content_media cm join contents c on c.id = cm.content_id where c.slug = $1
         union
         select cover_media_id from contents where slug = $1 and cover_media_id is not null
       )`,
      [SLUG],
    );
  });

  // dry-run：只统计不写库（本用例资产仍缺尺寸）
  const dry = await runCliOk(["media", "probe-dimensions"]);
  expect(dry).toContain("dry-run");
  expect((await ownImageDims()).every((d) => d.width === null)).toBe(true);

  // apply：回填（对象缺失/探测失败不阻断，可重跑）
  await runCliOk(["media", "probe-dimensions", "--apply"]);
  const restored = await ownImageDims();
  expect(restored.every((d) => d.width !== null && d.height !== null)).toBe(true);

  // 补刷后详情 API 恢复真实尺寸（含 EXIF 交换）
  const detail = await apiCall(`/api/contents/${SLUG}`);
  const media = detail.json.media as any[];
  expect([media[0].width, media[0].height]).toEqual([7, 3]);
  expect([media[2].width, media[2].height]).toEqual([50, 100]);
});
