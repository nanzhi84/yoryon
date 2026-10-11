/**
 * 验收 3/4：公开内容、付费预览（percent / marker / none 三种截断模式）、草稿不可见、
 * 未授权响应不包含付费正文与付费媒体。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall } from "../helpers/api";
import { E2E } from "../helpers/env";
import path from "node:path";

const postDir = (slug: string) => path.join(E2E.postsRoot, slug);

const stamp = runId();
const PUBLIC_SLUG = `pub-${stamp}`;
const PERCENT_SLUG = `percent-${stamp}`;
const MARKER_SLUG = `marker-${stamp}`;
const NONE_SLUG = `none-${stamp}`;
const DRAFT_SLUG = `draft-${stamp}`;

const SECRET_PERCENT = "PAID_SECRET_PERCENT_付费正文内容";
const SECRET_MARKER = "PAID_SECRET_MARKER_标记后内容";
const SECRET_NONE = "PAID_SECRET_NONE_完全付费内容";

test.describe("内容展示与预览截断", () => {
  test.beforeAll(async () => {
    // 公开文章（含免费区图片）
    await createPost({
      slug: PUBLIC_SLUG,
      title: "公开文章",
      visibility: "public",
      body: `# 公开标题\n\n${TINY_TEXT(1)}\n\n![封面图](./media/tiny.png)\n\n${TINY_TEXT(2)}`,
    });
    // 百分比预览（50%）：免费区两段文字，付费区含秘密文字与图片
    await createPost({
      slug: PERCENT_SLUG,
      title: "百分比预览文章",
      visibility: "paid",
      previewMode: "percent",
      previewPercent: 30,
      body: `${TINY_TEXT(1)}\n\n${TINY_TEXT(2)}\n\n${SECRET_PERCENT}\n\n${TINY_TEXT(3)}\n\n![付费图](./media/photo.png)`,
    });
    // Marker 预览
    await createPost({
      slug: MARKER_SLUG,
      title: "标记预览文章",
      visibility: "paid",
      previewMode: "marker",
      body: `${TINY_TEXT(1)}\n\n<!-- more -->\n\n${SECRET_MARKER}\n\n![付费图](./media/photo.png)`,
    });
    // 无正文预览
    await createPost({
      slug: NONE_SLUG,
      title: "完全付费文章",
      visibility: "paid",
      previewMode: "none",
      description: "只有描述可见",
      body: `${SECRET_NONE}\n\n${TINY_TEXT(1)}`,
    });
    // 草稿（先发布后取消发布）
    await createPost({ slug: DRAFT_SLUG, title: "草稿文章", body: "草稿正文" });
    for (const slug of [PUBLIC_SLUG, PERCENT_SLUG, MARKER_SLUG, NONE_SLUG, DRAFT_SLUG]) {
      await runCliOk(["publish", postDir(slug)]);
    }
    await runCliOk(["unpublish", DRAFT_SLUG]);
  });

  test("匿名可读公开内容全文（含免费媒体）", async ({ page }) => {
    await page.goto(`/p/${PUBLIC_SLUG}`);
    await expect(page.getByRole("heading", { name: "公开文章" })).toBeVisible();
    await expect(page.getByText("公开标题")).toBeVisible();
    const img = page.locator(`img[src^="/api/media/"]`).first();
    await expect(img).toBeVisible();
    // 图片可加载（经 BFF 302 → 签名 URL）
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test("草稿状态内容对外不可见", async ({ page }) => {
    const res = await apiCall(`/api/contents/${DRAFT_SLUG}`);
    expect(res.status).toBe(404);
    await page.goto(`/p/${DRAFT_SLUG}`);
    await expect(page.getByText("404")).toBeVisible();
  });

  test("percent 模式：免费区可见、付费正文与付费媒体不在响应中", async ({ page }) => {
    const res = await apiCall(`/api/contents/${PERCENT_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.json.access).toBe("preview");
    expect(res.json.hasPaidContent).toBe(true);
    expect(res.json.bodyMarkdown).toContain("段落内容 1");
    expect(res.json.bodyMarkdown).not.toContain(SECRET_PERCENT);
    // 边界段落按字符截断（#14）：免费区含段落 2 的字符级前缀，但不含完整段落
    const p2Reps = res.json.bodyMarkdown.split("段落内容 2。").length - 1;
    expect(p2Reps).toBeGreaterThan(0);
    expect(p2Reps).toBeLessThan(30);
    // 付费媒体不出现在未授权响应（media 列表只含 free）
    for (const m of res.json.media) expect(m.exposure).toBe("free");
    expect(res.headers.get("cache-control")).toContain("no-store");

    await page.goto(`/p/${PERCENT_SLUG}`);
    await expect(page.getByText(SECRET_PERCENT)).toHaveCount(0);
    await expect(page.getByText("以上内容仅为预览")).toBeVisible();
  });

  test("marker 模式：<!-- more --> 之前免费、之后付费", async ({ page }) => {
    const res = await apiCall(`/api/contents/${MARKER_SLUG}`);
    expect(res.json.access).toBe("preview");
    expect(res.json.bodyMarkdown).toContain("段落内容");
    expect(res.json.bodyMarkdown).not.toContain(SECRET_MARKER);
    expect(res.json.bodyMarkdown).not.toContain("<!-- more -->");

    await page.goto(`/p/${MARKER_SLUG}`);
    await expect(page.getByText(SECRET_MARKER)).toHaveCount(0);
  });

  test("none 模式：仅标题/描述可见，正文为空", async () => {
    const res = await apiCall(`/api/contents/${NONE_SLUG}`);
    expect(res.json.access).toBe("preview");
    expect(res.json.bodyMarkdown).toBe("");
    expect(res.json.description).toBe("只有描述可见");
  });

  test("首页信息流与标签页", async ({ page }) => {
    // BFF 层 feed（无 Next 页面缓存参与）
    const feed = await apiCall(`/api/feed`);
    const slugs = feed.json.items.filter((i: any) => i.kind === "content").map((i: any) => i.slug);
    expect(slugs).toContain(PUBLIC_SLUG);
    expect(slugs).not.toContain(DRAFT_SLUG);
    expect(feed.headers.get("cache-control")).toContain("public");

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Yoryon" })).toBeVisible();
  });
});
