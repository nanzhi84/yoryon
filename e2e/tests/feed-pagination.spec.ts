/**
 * 评审 P1/P2 回归：feed/tags 游标分页正确性与 sitemap 完整收录。
 * - 混排多页遍历：统一排序键 + (key desc, id desc, kind desc) 全序下无重复、无遗漏；
 *   同 sortKey、跨类型同 id 碰撞边界；不足一页时 nextCursor 必须为 null（正确终止）。
 * - 标签页 >20 条：浏览器端"加载更多"渲染后续条目（tags 合同统一），无运行时错误。
 * - sitemap 全量翻页：21+ 条内容全部收录。
 *
 * 数据策略：本用例内容 published_at 统一设为过去的微秒级时间戳（相邻 700μs，同一毫秒
 * 内含多篇且跨越毫秒边界），排序上沉到全库末尾，遍历断言必须翻到最后一页才能集齐——
 * 同时验证毫秒截断排序键在微秒写入路径下的一致性。
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { runCliOk } from "../helpers/cli";
import { apiCall, withDb } from "../helpers/api";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const POST_COUNT = 25; // > FEED_PAGE_SIZE(20)，触发多页
const TAG = `pgtag-${stamp}`;
const postSlug = (i: number) => `pg-${stamp}-${String(i).padStart(2, "0")}`;
const collSlug = (i: number) => `pgcoll-${stamp}-${i}`;
const COLLIDE_SLUG = `pgcoll-collide-${stamp}`;

test.describe.configure({ mode: "serial" });

test.describe("feed 游标分页正确性", () => {
  test.beforeAll(async () => {
    // 25 篇文章（同标签），嵌套在父目录下一次发布
    const batchDir = path.join(E2E.postsRoot, `pgbatch-${stamp}`);
    for (let i = 1; i <= POST_COUNT; i++) {
      const slug = postSlug(i);
      const dir = path.join(batchDir, slug);
      await fs.mkdir(path.join(dir, "media"), { recursive: true });
      await fs.writeFile(
        path.join(dir, "index.md"),
        `---\ntitle: 分页文章 ${i}\nslug: ${slug}\ntype: article\nvisibility: public\ntags: [${TAG}]\n---\n\n分页测试正文 ${i}\n`,
      );
    }
    await runCliOk(["publish", batchDir]);

    // 2 个普通合集 + 1 个与文章同 id 的碰撞合集（同 updated_at，强测全序 tie-break）
    await runCliOk(["collection", "create", collSlug(1), "--title", "分页合集一"]);
    await runCliOk(["collection", "create", collSlug(2), "--title", "分页合集二"]);
    await withDb(async (db) => {
      // 微秒级时间戳：相邻文章相差 700μs（同一毫秒内有多篇、且跨越毫秒边界），
      // 模拟 SQL 导入/修复脚本等绕过 JS Date 的写入路径，验证毫秒截断排序键的一致性。
      await db.query(
        `update contents c set published_at = t.ts from (
           select id, timestamp '2020-01-01 00:00:00' + (row_number() over (order by slug) * 700) * interval '1 microsecond' as ts
           from contents where slug like 'pg-${stamp}-%'
         ) t where c.id = t.id`,
      );
      await db.query(`update collections set updated_at = timestamp '2020-01-01 00:00:00.003500' where slug like 'pgcoll-${stamp}-%'`);
      // 碰撞合集：与 postSlug(1) 同 id、同 updated_at（trunc 后同键同 id，仅剩 kind 决定顺序）
      await db.query(
        `insert into collections (id, slug, title, description, visibility, created_at, updated_at)
         select id, $1, '碰撞合集', '', 'public', published_at, published_at from contents where slug = $2`,
        [COLLIDE_SLUG, postSlug(1)],
      );
    });
  });

  test("多页混排遍历：无重复、无遗漏、正确终止", async () => {
    // 数据前提：published_at 确实含微秒（非毫秒对齐），否则本用例未覆盖精度场景
    const offGrid = await withDb(
      async (db) =>
        (
          await db.query(
            `select count(*)::int as n from contents where slug like 'pg-${stamp}-%' and published_at <> date_trunc('milliseconds', published_at)`,
          )
        ).rows[0].n,
    );
    expect(offGrid, "测试数据未包含微秒级时间戳").toBeGreaterThan(0);

    const seen = new Map<string, string>(); // `${kind}:${id}` → slug
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const res = await apiCall(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      expect(res.status).toBe(200);
      pages++;
      expect(pages, "翻页未在预期页数内终止（nextCursor 未收敛为 null）").toBeLessThanOrEqual(50);
      const items = res.json.items as { kind: string; id: string; slug: string }[];
      for (const item of items) {
        const key = `${item.kind}:${item.id}`;
        expect(seen.has(key), `条目重复出现: ${item.kind} ${item.slug}`).toBe(false);
        seen.set(key, item.slug);
      }
      // 终止条件契约：不足一整页时 nextCursor 必须为 null（不允许"空跑一页才发现没有更多"）
      if (items.length < 20) expect(res.json.nextCursor, `第 ${pages} 页 ${items.length} 条但仍返回游标`).toBeNull();
      cursor = res.json.nextCursor;
      if (!cursor) break;
    }

    const slugs = new Set(seen.values());
    for (let i = 1; i <= POST_COUNT; i++) {
      expect(slugs.has(postSlug(i)), `feed 遍历遗漏 ${postSlug(i)}`).toBe(true);
    }
    for (const s of [collSlug(1), collSlug(2), COLLIDE_SLUG]) {
      expect(slugs.has(s), `feed 遍历遗漏合集 ${s}`).toBe(true);
    }
    // 碰撞边界：同 sortKey 同 id 的文章与合集都必须出现（kind 参与全序，互不遮蔽）
    const collideId = [...seen.entries()].find(([, slug]) => slug === postSlug(1))?.[0];
    const collideCollId = [...seen.entries()].find(([, slug]) => slug === COLLIDE_SLUG)?.[0];
    expect(collideId?.split(":")[1]).toBe(collideCollId?.split(":")[1]);
    expect(collideId?.startsWith("content:")).toBe(true);
    expect(collideCollId?.startsWith("collection:")).toBe(true);
  });

  test("标签页超过 20 条：加载更多渲染后续条目且无运行时错误", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.goto(`/tags/${TAG}`);
    // SSR 第一页恰好 20 条（该标签只有本用例的 25 篇）
    await expect(page.locator("main article")).toHaveCount(20);
    await page.getByRole("button", { name: "加载更多" }).click();
    await expect(page.locator("main article")).toHaveCount(POST_COUNT);
    // 后续条目带标签 chip（tags 字段在加载更多响应中存在，不再 undefined.map）
    await expect(page.locator("main article").nth(POST_COUNT - 1).getByText(`#${TAG}`)).toBeVisible();
    // 无后续内容时按钮消失（nextCursor 收敛）
    await expect(page.getByRole("button", { name: "加载更多" })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("sitemap 全量翻页收录 21+ 条内容", async ({ request }) => {
    const res = await request.get(`${E2E.webUrl}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (let i = 1; i <= POST_COUNT; i++) {
      expect(xml, `sitemap 缺少 ${postSlug(i)}`).toContain(`/p/${postSlug(i)}`);
    }
    for (const s of [collSlug(1), collSlug(2), COLLIDE_SLUG]) {
      expect(xml, `sitemap 缺少合集 ${s}`).toContain(`/c/${s}`);
    }
  });
});
