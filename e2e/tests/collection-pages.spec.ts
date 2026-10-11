/**
 * 合集列表页 / 关于页 / 文章页阅读栏宽度：
 * - 导航含「关于」「合集」入口（顺序：关于 | 合集 | 订阅 | 登录）；/c 列表页展示合集并可点进详情；详情页可见成员内容。
 * - 关于页展示头像/名字/多段简介/社交账号（site.config.ts 配置）。
 * - 文章页展示所属合集链接，点击回到合集页（系列连续阅读路径）。
 * - BFF 放行 GET /api/collections（公开缓存线：Cache-Control public）。
 * - 文章页正文与页头等宽（取消 42rem 收窄）。
 *
 * 数据策略：CLI 真实发布（合集 + 成员文章），runId 戳隔离，与既有用例并存不冲突。
 */
import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const COLL_SLUG = `colpage-${stamp}`;
const COLL_TITLE = `合集页测试合集 ${stamp}`;
const POST_SLUG = `colpage-post-${stamp}`;
const POST_TITLE = `合集页测试文章 ${stamp}`;

test.describe.configure({ mode: "serial" });

test.describe("合集页面", () => {
  test.beforeAll(async () => {
    await runCliOk(["collection", "create", COLL_SLUG, "--title", COLL_TITLE, "--description", "系列作品合集"]);
    const dir = await createPost({
      slug: POST_SLUG,
      title: POST_TITLE,
      collections: [COLL_SLUG],
      body: "系列第一篇正文。",
    });
    await runCliOk(["publish", dir]);

    // /c 为 force-dynamic + 内部 fetch Data Cache（revalidate=1s，SWR 语义）：
    // 缓存过期后的首个请求仍返回陈旧内容并后台重取，需轮询预热直至新合集出现在渲染结果中
    await expect
      .poll(
        async () => {
          const res = await fetch(`${E2E.webUrl}/c`);
          return res.ok && (await res.text()).includes(COLL_TITLE);
        },
        { timeout: 30_000, intervals: [1_500] },
      )
      .toBe(true);
  });

  test("BFF 放行 /api/collections 且为公开缓存线", async ({ request }) => {
    const res = await request.get(`${E2E.webUrl}/api/collections`);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("public");
    const data = (await res.json()) as { items: { slug: string; title: string; itemCount: number }[] };
    const mine = data.items.find((c) => c.slug === COLL_SLUG);
    expect(mine).toBeTruthy();
    expect(mine!.title).toBe(COLL_TITLE);
    expect(mine!.itemCount).toBe(1);
  });

  test("导航含合集入口，/c 列表 → 详情 → 成员文章链路可走通", async ({ page }) => {
    await page.goto("/");
    // 首页信息流为纯内容流：合集是顶层结构，只在 /c 列表曝光，不混排
    await expect(page.locator("main").getByText("合集 ·")).toHaveCount(0);
    await page.locator("header").getByRole("link", { name: "合集", exact: true }).click();
    await expect(page).toHaveURL("/c");

    // 列表出现合集条目（标题即链接），点击进详情
    await page.getByRole("link", { name: COLL_TITLE, exact: true }).click();
    await expect(page).toHaveURL(`/c/${COLL_SLUG}`);
    await expect(page.getByRole("heading", { name: COLL_TITLE })).toBeVisible();

    // 详情页成员可见，点进文章
    await page.getByRole("link", { name: POST_TITLE }).click();
    await expect(page).toHaveURL(`/p/${POST_SLUG}`);
  });

  test("文章页展示所属合集链接，点击回到合集页（系列连续阅读）", async ({ page }) => {
    await page.goto(`/p/${POST_SLUG}`);
    await page.getByRole("link", { name: `合集：${COLL_TITLE}` }).click();
    await expect(page).toHaveURL(`/c/${COLL_SLUG}`);
    await expect(page.getByRole("link", { name: POST_TITLE })).toBeVisible();
  });

  test("文章页正文与页头等宽", async ({ page }) => {
    await page.goto(`/p/${POST_SLUG}`);
    const headerBox = await page.locator("header").first().boundingBox();
    const mainBox = await page.locator("main").boundingBox();
    expect(headerBox).toBeTruthy();
    expect(mainBox).toBeTruthy();
    expect(Math.abs(mainBox!.width - headerBox!.width)).toBeLessThanOrEqual(1);
  });

  test("关于页：导航入口在合集左边，展示头像/名字/简介/社交账号", async ({ page }) => {
    await page.goto("/");
    // 导航顺序：关于 | 合集 | 订阅 | 登录
    const navLinks = await page.locator("header nav a").allInnerTexts();
    expect(navLinks).toEqual(["关于", "合集", "订阅", "登录"]);
    await page.locator("header").getByRole("link", { name: "关于", exact: true }).click();
    await expect(page).toHaveURL("/about");

    // 头像（未配置时为首字母占位）+ 名字 + 简介 + 社交账号罗列
    await expect(page.getByRole("heading", { name: "Yoryon" })).toBeVisible();
    await expect(page.locator("main").getByText("记录文章、图片、视频与音频。")).toBeVisible();
    for (const label of ["GitHub", "X", "Bilibili", "Email"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });
});
