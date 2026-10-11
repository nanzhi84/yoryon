/**
 * Content Analytics V1 端到端验收（docs/analytics.md、ADR-0007）：
 * 1. 首页曝光：≥50% 可视且连续 1s 记一次 impression；重复进出视口不重复；页面后台不触发；
 * 2. 标题点击记 click 且不干扰导航；卡片内标签链接不计入 click；
 * 3. 预取不产生 view；站外直达只有 view 无 click；刷新/客户端导航各计一个浏览实例；
 * 4. 前台累计可见 ≥10s 记一次 read，切后台暂停累计；
 * 5. 合集与作品同一协议、独立统计（合集行为不累计到成员作品）；
 * 6. 采集请求失败不阻塞内容展示与导航；
 * 7. ingest：Zod 白名单 / 单批上限 / placement 语义 / 非法目标静默丢弃 / event_id 幂等去重；
 * 8. CLI：四项指标、CTR/Read Rate、分母零 N/A、prune 保留策略；
 * 9. IP 维度限流返回 429（放在最后，避免共享桶污染其他用例）。
 *
 * 工件：断言全部经真实浏览器路径触发事件并落库（analytics_events 直查核验），
 * 最终以 CLI 报表输出核验四项指标，形成"浏览器 → BFF → API → PG → CLI"闭环。
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { runCliOk } from "../helpers/cli";
import { apiCall, withDb } from "../helpers/api";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const ARTICLE = `an-${stamp}-post`;
const ARTICLE_TITLE = `Analytics 文章 ${stamp}`;
const NA_ARTICLE = `an-${stamp}-na`;
const DRAFT = `an-${stamp}-draft`;
const COLL = `an-${stamp}-coll`;
const COLL_TITLE = `Analytics 合集 ${stamp}`;
const TAG = `antag${stamp.replace(/\D/g, "").slice(-8)}`;

let articleId: string;
let naId: string;
let draftId: string;
let collId: string;

test.describe.configure({ mode: "serial" });

async function countEvents(targetId: string, eventType: string): Promise<number> {
  return withDb(async (db) => {
    const r = await db.query(`select count(*)::int as n from analytics_events where target_id = $1 and event_type = $2`, [targetId, eventType]);
    return r.rows[0].n as number;
  });
}

/** 轮询直至事件数达到 min（采集为异步批量提交，需要等待 flush）。 */
async function pollEvents(targetId: string, eventType: string, min: number, timeoutMs = 20_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const n = await countEvents(targetId, eventType);
    if (n >= min) return n;
    if (Date.now() > deadline) throw new Error(`等待 ${eventType}(${targetId}) >= ${min} 超时，当前 ${n}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** 模拟页面切后台/回前台（覆盖 visibilityState 并派发事件，验证 tracker 的暂停/恢复逻辑）。 */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function scrollCardIntoView(page: Page, title: string) {
  const card = page.locator("article", { hasText: title }).first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  return card;
}

test.beforeAll(async () => {
  await runCliOk(["collection", "create", COLL, "--title", COLL_TITLE]);
  await runCliOk(["publish", await createPost({ slug: ARTICLE, title: ARTICLE_TITLE, cover: "./media/tiny.png", tags: [TAG], collections: [COLL], body: TINY_TEXT(1) })]);
  await runCliOk(["publish", await createPost({ slug: NA_ARTICLE, title: `Analytics NA ${stamp}`, body: TINY_TEXT(2) })]);
  await runCliOk(["publish", await createPost({ slug: DRAFT, title: `Analytics 草稿 ${stamp}`, body: TINY_TEXT(3) })]);
  await runCliOk(["unpublish", DRAFT]);

  await withDb(async (db) => {
    articleId = (await db.query(`select id from contents where slug = $1`, [ARTICLE])).rows[0].id;
    naId = (await db.query(`select id from contents where slug = $1`, [NA_ARTICLE])).rows[0].id;
    draftId = (await db.query(`select id from contents where slug = $1`, [DRAFT])).rows[0].id;
    collId = (await db.query(`select id from collections where slug = $1`, [COLL])).rows[0].id;
  });

  // 触发首页与合集列表的 ISR 重新验证（E2E revalidate=1s），保证新内容可见
  await fetch(`${E2E.webUrl}/`).catch(() => {});
  await fetch(`${E2E.webUrl}/c`).catch(() => {});
  await new Promise((r) => setTimeout(r, 1_500));
  await fetch(`${E2E.webUrl}/`).catch(() => {});
  await fetch(`${E2E.webUrl}/c`).catch(() => {});
});

test("首页曝光：≥50% 可视连续 1s 记一次 impression，重复进出视口不重复", async ({ page }) => {
  await page.goto("/");
  const card = await scrollCardIntoView(page, ARTICLE_TITLE);
  await pollEvents(articleId, "impression", 1);

  // 滑出视口再滑回：同一浏览实例不重复计数
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1_500);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_500);
  expect(await countEvents(articleId, "impression")).toBe(1);
});

test("连续滚动跨越更高可见阈值不重置曝光计时（回归：60% → 100% 连续可见不重新计时）", async ({ page }) => {
  // 拦截采集请求以观测 impression 的真实入队时间（flush 有 2s 间隔，直接查库无法区分计时起点）
  let impSentAt: number | null = null;
  await page.route("**/api/analytics/events", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes('"impression"') && body.includes(articleId)) impSentAt ??= Date.now();
    await route.continue();
  });
  await page.goto("/");
  const card = page.locator("article", { hasText: ARTICLE_TITLE }).first();
  await card.waitFor({ state: "attached" });

  // t0：卡片约 60% 可见（顶部滑出视口），进入合格状态开始计时
  await page.evaluate((title) => {
    const el = [...document.querySelectorAll("article")].find((a) => a.textContent?.includes(title))!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + el.offsetHeight * 0.4);
  }, ARTICLE_TITLE);
  const t0 = Date.now();
  await page.waitForTimeout(600);
  // t0+0.6s：滚回完全可见，跨越 100% 阈值——连续可见不中断，计时不得重置
  await page.evaluate((title) => {
    const el = [...document.querySelectorAll("article")].find((a) => a.textContent?.includes(title))!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
  }, ARTICLE_TITLE);
  await page.waitForTimeout(800);
  // t0+1.4s：连续可见已累计 1.4s（>1s），impression 应已入队；切后台触发 beacon 立即冲刷
  await setHidden(page, true);
  await expect.poll(() => impSentAt !== null, { timeout: 3_000 }).toBe(true);
  // 若计时在跨阈值时重置（t0+0.6s 才重新开始），此刻事件尚未产生或被切后台取消
  expect(impSentAt! - t0).toBeLessThan(2_500);
  await setHidden(page, false);
});

test("页面后台不触发 impression；回前台后才计时", async ({ page }) => {
  const before = await countEvents(articleId, "impression");
  await page.goto("/");
  const card = page.locator("article", { hasText: ARTICLE_TITLE }).first();
  await card.waitFor({ state: "attached" });
  // 在 1s 计时完成前切入后台：计时必须暂停
  await setHidden(page, true);
  await page.waitForTimeout(3_000);
  expect(await countEvents(articleId, "impression")).toBe(before);
  // 回前台：重新计时 1s 后产生新实例的 impression
  await setHidden(page, false);
  await card.scrollIntoViewIfNeeded();
  await pollEvents(articleId, "impression", before + 1);
});

test("标题点击记 click（placement=home_feed）并正常导航；标签链接不计入 click", async ({ page }) => {
  const clicksBefore = await countEvents(articleId, "click");
  await page.goto("/");
  await scrollCardIntoView(page, ARTICLE_TITLE);

  // 卡片内标签链接：不是标题/封面入口，不产生 click
  await page.locator("article", { hasText: ARTICLE_TITLE }).getByRole("link", { name: `#${TAG}` }).click();
  await page.waitForURL(`/tags/${TAG}`);
  await page.waitForTimeout(2_000);
  expect(await countEvents(articleId, "click")).toBe(clicksBefore);

  // 标题入口：记 click，且正常完成客户端导航
  await page.goto("/");
  await scrollCardIntoView(page, ARTICLE_TITLE);
  await page.getByRole("link", { name: ARTICLE_TITLE }).first().click();
  await page.waitForURL(`/p/${ARTICLE}`);
  await expect(page.getByRole("heading", { name: ARTICLE_TITLE })).toBeVisible();
  await pollEvents(articleId, "click", clicksBefore + 1);
  const placement = await withDb(async (db) => {
    const r = await db.query(`select placement from analytics_events where target_id = $1 and event_type = 'click' order by received_at desc limit 1`, [articleId]);
    return r.rows[0].placement as string;
  });
  expect(placement).toBe("home_feed");
});

test("预取不产生 view；站外直达只有 view 无 click；刷新产生新浏览实例；前台 10s 记一次 read", async ({ page }) => {
  // 首页停留期间 Link 预取已发生，但不得产生 view
  const viewsBefore = await countEvents(articleId, "view");
  const clicksBefore = await countEvents(articleId, "click");
  await page.goto("/");
  await scrollCardIntoView(page, ARTICLE_TITLE);
  await page.waitForTimeout(3_000);
  expect(await countEvents(articleId, "view")).toBe(viewsBefore);

  // 站外直达（整页加载）：view +1，无新增 click
  await page.goto(`/p/${ARTICLE}`);
  await expect(page.getByRole("heading", { name: ARTICLE_TITLE })).toBeVisible();
  await pollEvents(articleId, "view", viewsBefore + 1);
  expect(await countEvents(articleId, "click")).toBe(clicksBefore);

  // 刷新 = 新浏览实例：view 再 +1
  await page.reload();
  await pollEvents(articleId, "view", viewsBefore + 2);

  // 前台累计 10s：read 恰好一次，继续等待不重复
  await pollEvents(articleId, "read", 1, 25_000);
  await page.waitForTimeout(3_000);
  expect(await countEvents(articleId, "read")).toBe(1);
});

test("合集独立统计：/c 列表 impression(placement=collection_list) + click；合集详情 view；read 后台暂停", async ({ page }) => {
  const articleViewsBefore = await countEvents(articleId, "view");

  // /c 列表曝光
  await page.goto("/c");
  await scrollCardIntoView(page, COLL_TITLE);
  await pollEvents(collId, "impression", 1);
  const collPlacement = await withDb(async (db) => {
    const r = await db.query(`select placement from analytics_events where target_id = $1 and event_type = 'impression' limit 1`, [collId]);
    return r.rows[0].placement as string;
  });
  expect(collPlacement).toBe("collection_list");

  // 点击合集标题 → 合集详情：click + view
  await page.getByRole("link", { name: COLL_TITLE }).first().click();
  await page.waitForURL(`/c/${COLL}`);
  await pollEvents(collId, "click", 1);
  await pollEvents(collId, "view", 1);

  // read 暂停语义：可见 4s → 后台 8s（不得触发 read）→ 回前台补足 10s 才触发
  await page.waitForTimeout(4_000);
  await setHidden(page, true);
  await page.waitForTimeout(8_000);
  expect(await countEvents(collId, "read")).toBe(0);
  await setHidden(page, false);
  await pollEvents(collId, "read", 1, 20_000);

  // 合集行为不累计到成员作品
  expect(await countEvents(articleId, "view")).toBe(articleViewsBefore);
});

test("采集请求失败不阻塞内容展示与导航", async ({ page }) => {
  await page.route("**/api/analytics/events", (route) => route.abort());
  await page.goto("/");
  const card = await scrollCardIntoView(page, ARTICLE_TITLE);
  await expect(card.getByRole("link", { name: ARTICLE_TITLE }).first()).toBeVisible();
  await page.getByRole("link", { name: ARTICLE_TITLE }).first().click();
  await page.waitForURL(`/p/${ARTICLE}`);
  await expect(page.getByRole("heading", { name: ARTICLE_TITLE })).toBeVisible();
});

test("ingest：白名单校验、单批上限、placement 语义、非法目标丢弃、event_id 幂等", async () => {
  const asBff = { clientIp: "203.0.113.10" };
  const base = { eventId: randomUUID(), targetKind: "work", targetId: articleId, pageViewId: randomUUID() };

  // 非法载荷 → 400
  for (const body of [
    {},
    { events: [] },
    { events: [{ ...base, eventType: "scroll" }] },
    { events: [{ ...base, eventType: "view", targetId: "not-a-uuid" }] },
    { events: Array.from({ length: 21 }, () => ({ ...base, eventType: "view", eventId: randomUUID() })) },
    { events: [{ ...base, eventType: "impression" }] }, // impression 缺 placement
  ]) {
    const r = await apiCall("/api/analytics/events", body, { asBff });
    expect(r.status, JSON.stringify(body).slice(0, 120)).toBe(400);
  }

  // 非法目标（随机 uuid / 草稿内容 / 草稿合集不存在）：静默丢弃，200 + accepted=0
  for (const target of [
    { targetKind: "work", targetId: randomUUID() },
    { targetKind: "work", targetId: draftId },
    { targetKind: "collection", targetId: randomUUID() },
  ]) {
    const r = await apiCall("/api/analytics/events", { events: [{ ...base, ...target, eventType: "view", eventId: randomUUID() }] }, { asBff });
    expect(r.status).toBe(200);
    expect(r.json.accepted).toBe(0);
  }

  // 幂等：同一 event_id 重投两次，库中仅一条
  const eventId = randomUUID();
  const evt = { ...base, eventId, eventType: "view" };
  for (let i = 0; i < 2; i++) {
    const r = await apiCall("/api/analytics/events", { events: [evt] }, { asBff });
    expect(r.status).toBe(200);
    expect(r.json.accepted).toBe(1);
  }
  const dup = await withDb(async (db) => (await db.query(`select count(*)::int as n from analytics_events where event_id = $1`, [eventId])).rows[0].n);
  expect(dup).toBe(1);

  // placement 归一：view/read 携带的 placement 不落库
  const evtWithPlacement = { ...base, eventId: randomUUID(), eventType: "view", placement: "home_feed" };
  const r = await apiCall("/api/analytics/events", { events: [evtWithPlacement] }, { asBff });
  expect(r.json.accepted).toBe(1);
  const placement = await withDb(async (db) => (await db.query(`select placement from analytics_events where event_id = $1`, [evtWithPlacement.eventId])).rows[0].placement);
  expect(placement).toBeNull();

  // 跨表面事件（placement 与 target kind 的唯一列表表面不一致，ADR-0007 §4）：静默丢弃
  for (const bad of [
    { targetKind: "work", targetId: articleId, placement: "collection_list" },
    { targetKind: "collection", targetId: collId, placement: "home_feed" },
  ]) {
    const r = await apiCall("/api/analytics/events", { events: [{ ...base, ...bad, eventType: "impression", eventId: randomUUID() }] }, { asBff });
    expect(r.status).toBe(200);
    expect(r.json.accepted).toBe(0);
  }

  // 大载荷（>32KB）：BFF 按 Content-Length 预拦截，API 按声明值+实际长度双检查，均 413
  const big = { events: [{ ...base, eventType: "view", eventId: randomUUID(), pad: "x".repeat(40 * 1024) }] };
  const bigApi = await apiCall("/api/analytics/events", big, { asBff });
  expect(bigApi.status).toBe(413);
  const bigBff = await fetch(`${E2E.webUrl}/api/analytics/events`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: E2E.webUrl },
    body: JSON.stringify(big),
  });
  expect(bigBff.status).toBe(413);
});

test("CLI：overview/top/content/collection 输出四项指标与 N/A；prune 清理过期事件", async () => {
  const overview = await runCliOk(["analytics", "overview", "--days", "7"]);
  expect(overview).toContain("统计窗口");
  expect(overview).toMatch(/\[work\].*impressions=\d+.*clicks=\d+.*views=\d+.*reads=\d+/);
  expect(overview).toContain("[collection]");

  const content = await runCliOk(["analytics", "content", ARTICLE, "--days", "7"]);
  expect(content).toContain(ARTICLE);
  expect(content).toMatch(/work\/article/);
  // 该文章既有 impressions 也有 clicks → CTR 为百分比而非 N/A
  expect(content).toMatch(/\d+\.\d%/);

  const collection = await runCliOk(["analytics", "collection", COLL, "--days", "7"]);
  expect(collection).toContain(COLL);
  expect(collection).toContain("collection");

  const topViews = await runCliOk(["analytics", "top", "--metric", "views", "--days", "7"]);
  expect(topViews).toContain(ARTICLE);
  const topCtr = await runCliOk(["analytics", "top", "--metric", "ctr", "--days", "7", "--min-impressions", "1"]);
  expect(topCtr).toContain(ARTICLE);

  // 精确数值：合成已知事件（10 impressions / 3 clicks / 4 views / 2 reads），
  // 核对 CTR=30.0%、Read Rate=50.0%，并验证最小曝光阈值的排除行为
  const EXACT = `an-${stamp}-exact`;
  await runCliOk(["publish", await createPost({ slug: EXACT, title: `Analytics 精确 ${stamp}`, body: TINY_TEXT(4) })]);
  const exactId = await withDb(async (db) => (await db.query(`select id from contents where slug = $1`, [EXACT])).rows[0].id as string);
  await withDb(async (db) => {
    await db.query(
      `insert into analytics_events (event_id, event_type, target_kind, target_id, placement, page_view_id)
       select gen_random_uuid(), t, 'work', $1::uuid,
              case when t in ('impression','click') then 'home_feed' end,
              gen_random_uuid()
       from unnest(array['impression','click','view','read']) as t,
            generate_series(1, case t when 'impression' then 10 when 'click' then 3 when 'view' then 4 else 2 end)`,
      [exactId],
    );
  });
  const exact = await runCliOk(["analytics", "content", EXACT, "--days", "7"]);
  expect(exact).toContain("30.0%"); // CTR = 3 clicks / 10 impressions
  expect(exact).toContain("50.0%"); // Read Rate = 2 reads / 4 views
  // 最小曝光阈值：10 次曝光的目标应被 --min-impressions 20 排除、被 10 纳入
  const topExcluded = await runCliOk(["analytics", "top", "--metric", "ctr", "--days", "7", "--min-impressions", "20"]);
  expect(topExcluded).not.toContain(EXACT);
  const topIncluded = await runCliOk(["analytics", "top", "--metric", "ctr", "--days", "7", "--min-impressions", "10"]);
  expect(topIncluded).toContain(EXACT);

  // 分母为零 → N/A：新建无事件的合集（此前浏览器用例均未访问），ctr 与 read_rate 均为 N/A
  const quiet = `an-${stamp}-quiet`;
  await runCliOk(["collection", "create", quiet, "--title", `静默合集 ${stamp}`]);
  const na = await runCliOk(["analytics", "collection", quiet, "--days", "7"]);
  expect(na).toContain("N/A");

  // prune：400 天前的事件被清理，近期事件保留
  const oldEventId = randomUUID();
  await withDb(async (db) => {
    await db.query(
      `insert into analytics_events (event_id, event_type, target_kind, target_id, page_view_id, received_at)
       values ($1, 'view', 'work', $2, $3, now() - interval '400 days')`,
      [oldEventId, naId, randomUUID()],
    );
  });
  const prune = await runCliOk(["analytics", "prune", "--days", "365"]);
  expect(prune).toContain("已删除");
  const remaining = await withDb(async (db) => (await db.query(`select count(*)::int as n from analytics_events where event_id = $1`, [oldEventId])).rows[0].n);
  expect(remaining).toBe(0);
  // 近期事件不受 prune 影响
  expect(await countEvents(exactId, "view")).toBe(4);
});

test("限流：单 IP 超阈值返回 429", async () => {
  // RATE_LIMIT_SCALE=8 → 阈值 480 批/分钟；本用例最后执行，避免共享桶污染其他用例
  const lastOctet = (Date.now() % 200) + 1;
  const asBff = { clientIp: `203.0.113.${lastOctet}` };
  const evt = { eventId: randomUUID(), eventType: "view", targetKind: "work", targetId: randomUUID(), pageViewId: randomUUID() };
  const statuses: number[] = [];
  for (let i = 0; i < 10; i++) {
    const batch = await Promise.all(Array.from({ length: 50 }, () => apiCall("/api/analytics/events", { events: [{ ...evt, eventId: randomUUID() }] }, { asBff })));
    statuses.push(...batch.map((r) => r.status));
  }
  expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0);
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
});
