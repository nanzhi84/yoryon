/**
 * 验收 5/7：订阅区间链——连续兑换接续、并发不丢有效期、撤销空洞语义、过期回落。
 * 验收 9：合集授权动态覆盖新增内容。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall, registerUser, withDb } from "../helpers/api";
import { E2E } from "../helpers/env";
import path from "node:path";

const stamp = runId();

async function createCode(args: string[]): Promise<string> {
  const out = await runCliOk(["code", "create", ...args]);
  return /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(out)![1]!;
}

test.describe("订阅区间链", () => {
  let token: string;
  let userId: string;

  test.beforeAll(async () => {
    const email = `e2e-sub-${stamp}@example.com`;
    token = await registerUser(email, `sub${stamp}`, "password123", { asBff: { clientIp: "10.40.1.1" } });
    const me = await apiCall("/api/auth/me", undefined, { token });
    userId = me.json.user.id;
  });

  test("连续兑换两个 30 天码 → 覆盖 60 天（区间接续）", async () => {
    const code1 = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);
    const code2 = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);

    const r1 = await apiCall("/api/redemptions", { code: code1 }, { token, asBff: { clientIp: "10.40.1.2" } });
    expect(r1.status).toBe(200);
    const r2 = await apiCall("/api/redemptions", { code: code2 }, { token, asBff: { clientIp: "10.40.1.3" } });
    expect(r2.status).toBe(200);

    const e1 = r1.json.entitlement;
    const e2 = r2.json.entitlement;
    // 第二笔 valid_from 接续第一笔 valid_until
    expect(new Date(e2.validFrom).getTime()).toBe(new Date(e1.validUntil).getTime());
    // 总覆盖约 60 天
    const spanDays = (new Date(e2.validUntil).getTime() - new Date(e1.validFrom).getTime()) / 86400000;
    expect(Math.round(spanDays)).toBe(60);
  });

  test("不同订阅码并发兑换：有效期不丢失（总覆盖 = 两码之和）", async () => {
    const email = `e2e-sub2-${stamp}@example.com`;
    const t2 = await registerUser(email, `sub2${stamp}`, "password123", { asBff: { clientIp: "10.40.2.1" } });
    const codeA = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);
    const codeB = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);

    // 并发兑换两个不同码（用户行锁串行化，base 接续不丢更新）
    const [ra, rb] = await Promise.all([
      apiCall("/api/redemptions", { code: codeA }, { token: t2, asBff: { clientIp: "10.40.2.2" } }),
      apiCall("/api/redemptions", { code: codeB }, { token: t2, asBff: { clientIp: "10.40.2.3" } }),
    ]);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    const ea = ra.json.entitlement;
    const eb = rb.json.entitlement;
    const from = Math.min(new Date(ea.validFrom).getTime(), new Date(eb.validFrom).getTime());
    const until = Math.max(new Date(ea.validUntil).getTime(), new Date(eb.validUntil).getTime());
    expect(Math.round((until - from) / 86400000)).toBe(60);
  });

  test("撤销中间一笔 → 区间空洞语义；全部撤销 → 回落预览态", async () => {
    // 准备一篇付费内容
    const slug = `sub-paid-${stamp}`;
    await createPost({ slug, title: "订阅可见", visibility: "paid", previewMode: "none", body: "付费正文 SECRET_SUB" });
    await runCliOk(["publish", path.join(E2E.postsRoot, slug)]);

    const email = `e2e-sub3-${stamp}@example.com`;
    const t3 = await registerUser(email, `sub3${stamp}`, "password123", { asBff: { clientIp: "10.40.3.1" } });

    // 连续兑换三笔（手工控制时间：先兑两笔，再把中间那笔的区间经 DB 调整为“现在生效”，制造可撤销的中间段）
    const codes = await Promise.all([
      createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]),
      createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]),
      createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]),
    ]);
    const ids: string[] = [];
    for (const [i, code] of codes.entries()) {
      const r = await apiCall("/api/redemptions", { code }, { token: t3, asBff: { clientIp: `10.40.3.${2 + i}` } });
      expect(r.status).toBe(200);
      ids.push(r.json.entitlement.id);
    }

    // 订阅生效 → 全文
    expect((await apiCall(`/api/contents/${slug}`, undefined, { token: t3 })).json.access).toBe("full");

    // 撤销中间一笔 → 其余区间不重排（第一笔仍覆盖现在 → 仍可访问）
    await runCliOk(["entitlement", "revoke", ids[1]!, "--reason", "test middle revoke"]);
    expect((await apiCall(`/api/contents/${slug}`, undefined, { token: t3 })).json.access).toBe("full");

    // 全部撤销 → 回落预览
    await runCliOk(["entitlement", "revoke", ids[0]!, "--reason", "test revoke"]);
    await runCliOk(["entitlement", "revoke", ids[2]!, "--reason", "test revoke"]);
    const after = await apiCall(`/api/contents/${slug}`, undefined, { token: t3 });
    expect(after.json.access).toBe("preview");
    expect(after.json.bodyMarkdown).not.toContain("SECRET_SUB");
  });

  test("过期订阅权益 → 回落预览态", async () => {
    const slug = `sub-expired-${stamp}`;
    await createPost({ slug, title: "过期订阅", visibility: "paid", previewMode: "none", body: "SECRET_EXPIRED" });
    await runCliOk(["publish", path.join(E2E.postsRoot, slug)]);

    const email = `e2e-sub4-${stamp}@example.com`;
    const t4 = await registerUser(email, `sub4${stamp}`, "password123", { asBff: { clientIp: "10.40.4.1" } });
    const code = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);
    const r = await apiCall("/api/redemptions", { code }, { token: t4, asBff: { clientIp: "10.40.4.2" } });
    expect((await apiCall(`/api/contents/${slug}`, undefined, { token: t4 })).json.access).toBe("full");

    // 把权益区间整体平移到过去（模拟已过期）
    await withDb(async (db) => {
      await db.query(
        `update entitlements set valid_from = valid_from - interval '60 days', valid_until = valid_until - interval '60 days' where id = $1`,
        [r.json.entitlement.id],
      );
    });
    expect((await apiCall(`/api/contents/${slug}`, undefined, { token: t4 })).json.access).toBe("preview");
  });
});

test.describe("合集授权动态覆盖", () => {
  test("合集码 → 成员解锁；合集新增内容自动被覆盖", async () => {
    const collSlug = `coll-${stamp}`;
    const slug1 = `coll-a-${stamp}`;
    const slug2 = `coll-b-${stamp}`;
    await createPost({ slug: slug1, title: "合集成员一", visibility: "paid", previewMode: "none", body: "SECRET_COLL_A", collections: [collSlug] });
    await runCliOk(["collection", "create", collSlug, "--title", "测试合集", "--visibility", "paid"]);
    await runCliOk(["publish", path.join(E2E.postsRoot, slug1)]);

    const email = `e2e-coll-${stamp}@example.com`;
    const t = await registerUser(email, `coll${stamp}`, "password123", { asBff: { clientIp: "10.50.1.1" } });
    const code = await createCode(["--grant-type", "collection", "--collection", collSlug, "--count", "1"]);
    const r = await apiCall("/api/redemptions", { code }, { token: t, asBff: { clientIp: "10.50.1.2" } });
    expect(r.status).toBe(200);

    // 成员一解锁
    expect((await apiCall(`/api/contents/${slug1}`, undefined, { token: t })).json.access).toBe("full");

    // 新增内容到合集（发布时 frontmatter 声明 collections）→ 旧授权自动覆盖
    await createPost({ slug: slug2, title: "合集成员二", visibility: "paid", previewMode: "none", body: "SECRET_COLL_B", collections: [collSlug] });
    await runCliOk(["publish", path.join(E2E.postsRoot, slug2)]);
    const res = await apiCall(`/api/contents/${slug2}`, undefined, { token: t });
    expect(res.json.access).toBe("full");
    expect(res.json.bodyMarkdown).toContain("SECRET_COLL_B");

    // 合集页面成员按 sort_order
    const coll = await apiCall(`/api/collections/${collSlug}`, undefined, { token: t });
    expect(coll.json.items.map((i: any) => i.slug)).toEqual([slug1, slug2]);
  });

  test("浏览器端兑换页完整流程", async ({ page }) => {
    const email = `e2e-redeemui-${stamp}@example.com`;
    const username = `redeemui${stamp}`;
    // 注册（API），再走 UI 登录 + 兑换（真实用户路径）
    await registerUser(email, username, "password123", { asBff: { clientIp: "10.50.2.1" } });
    const slug = `redeemui-${stamp}`;
    await createPost({ slug, title: "UI 兑换文章", visibility: "paid", previewMode: "none", body: "SECRET_UI_REDEEM" });
    await runCliOk(["publish", path.join(E2E.postsRoot, slug)]);
    const code = await createCode(["--grant-type", "content", "--content", slug, "--count", "1"]);

    await page.goto("/login");
    await page.getByLabel("邮箱或用户名").fill(email);
    await page.getByLabel("密码").fill("password123");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/redeem");
    await page.getByLabel("激活码").fill(code);
    await page.getByRole("button", { name: "兑换" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("兑换成功");
    await expect(page.getByText("单篇内容")).toBeVisible();

    await page.goto(`/p/${slug}`);
    await expect(page.getByText("SECRET_UI_REDEEM")).toBeVisible();
  });
});
