/**
 * 验收 5/6：激活码兑换成功、重复兑换幂等、无效/停用/过期码、并发兑换不超发、max_uses 限制。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall, registerUser } from "../helpers/api";
import { E2E } from "../helpers/env";
import path from "node:path";

const stamp = runId();
const SLUG = `redeem-${stamp}`;

async function createCode(args: string[]): Promise<string> {
  const out = await runCliOk(["code", "create", ...args]);
  const m = /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(out);
  if (!m) throw new Error(`no code in output: ${out}`);
  return m[1]!;
}

test.describe("激活码兑换", () => {
  let userToken: string;

  test.beforeAll(async () => {
    await createPost({
      slug: SLUG,
      title: "付费文章",
      visibility: "paid",
      previewMode: "none",
      body: `${TINY_TEXT(1)}`,
    });
    await runCliOk(["publish", path.join(E2E.postsRoot, SLUG)]);
    const email = `e2e-redeem-${stamp}@example.com`;
    userToken = await registerUser(email, `redeem${stamp}`, "password123", { asBff: { clientIp: "10.30.1.1" } });
  });

  test("兑换成功 → 全文可见；重复兑换幂等且计数不增", async () => {
    const code = await createCode(["--grant-type", "content", "--content", SLUG, "--count", "1"]);

    // 兑换前：预览
    const before = await apiCall(`/api/contents/${SLUG}`, undefined, { token: userToken });
    expect(before.json.access).toBe("preview");

    // 浏览器端兑换（真实用户路径）
    // （直接用 API 保持本用例聚焦兑换语义；浏览器路径在 subscription 用例覆盖）
    const r1 = await apiCall("/api/redemptions", { code }, { token: userToken, asBff: { clientIp: "10.30.1.2" } });
    expect(r1.status).toBe(200);
    expect(r1.json.idempotent).toBe(false);

    // 兑换后：全文
    const after = await apiCall(`/api/contents/${SLUG}`, undefined, { token: userToken });
    expect(after.json.access).toBe("full");
    expect(after.json.bodyMarkdown).toContain("段落内容");

    // 重复兑换：幂等成功、used_count 不增
    const r2 = await apiCall("/api/redemptions", { code }, { token: userToken, asBff: { clientIp: "10.30.1.3" } });
    expect(r2.status).toBe(200);
    expect(r2.json.idempotent).toBe(true);
    expect(r2.json.entitlement.id).toBe(r1.json.entitlement.id);

    const list = await runCliOk(["code", "list"]);
    const line = list.split("\n").find((l) => l.includes(code));
    expect(line).toContain("used 1/1");
  });

  test("无效 / 停用 / 过期码", async () => {
    const bad = await apiCall("/api/redemptions", { code: "AAAA-BBBB-CCCC-DDDD" }, { token: userToken, asBff: { clientIp: "10.30.2.1" } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("invalid_code");

    const code = await createCode(["--grant-type", "content", "--content", SLUG, "--count", "1"]);
    await runCliOk(["code", "disable", code]);
    const disabled = await apiCall("/api/redemptions", { code }, { token: userToken, asBff: { clientIp: "10.30.2.2" } });
    expect(disabled.json.error.code).toBe("code_disabled");

    const expiredCode = await createCode(["--grant-type", "content", "--content", SLUG, "--count", "1", "--expires", "2000-01-01"]);
    const expired = await apiCall("/api/redemptions", { code: expiredCode }, { token: userToken, asBff: { clientIp: "10.30.2.3" } });
    expect(expired.json.error.code).toBe("code_expired");
  });

  test("max_uses=2：第三个用户兑换失败（防超发）", async () => {
    const code = await createCode(["--grant-type", "content", "--content", SLUG, "--count", "1", "--max-uses", "2"]);
    const users = await Promise.all(
      [1, 2, 3].map((i) => registerUser(`e2e-mu-${stamp}-${i}@example.com`, `mu${stamp}${i}`, "password123", { asBff: { clientIp: `10.30.3.${i}` } })),
    );
    const results = [];
    for (const [i, token] of users.entries()) {
      results.push(await apiCall("/api/redemptions", { code }, { token, asBff: { clientIp: `10.30.4.${i + 1}` } }));
    }
    const ok = results.filter((r) => r.status === 200);
    const exhausted = results.filter((r) => r.status === 409 && r.json.error.code === "code_exhausted");
    expect(ok.length).toBe(2);
    expect(exhausted.length).toBe(1);
  });

  test("并发兑换：同一码 N 个用户同时兑换不超发；同一用户重复并发兑换幂等", async () => {
    const code = await createCode(["--grant-type", "content", "--content", SLUG, "--count", "1", "--max-uses", "3"]);
    const users = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => registerUser(`e2e-cc-${stamp}-${i}@example.com`, `cc${stamp}${i}`, "password123", { asBff: { clientIp: `10.30.5.${i}` } })),
    );
    // 5 用户并发抢 max_uses=3 的码
    const results = await Promise.all(
      users.map((token, i) => apiCall("/api/redemptions", { code }, { token, asBff: { clientIp: `10.30.6.${i + 1}` } })),
    );
    const ok = results.filter((r) => r.status === 200);
    expect(ok.length).toBe(3);
    expect(results.filter((r) => r.status === 409 && r.json.error.code === "code_exhausted").length).toBe(2);

    // 同一用户（第一轮胜出者）并发重复兑换：全部幂等成功，权益只有一条
    const winnerIdx = results.findIndex((r) => r.status === 200);
    const winner = users[winnerIdx]!;
    const dupes = await Promise.all(
      [1, 2, 3].map((i) => apiCall("/api/redemptions", { code }, { token: winner, asBff: { clientIp: `10.30.7.${i}` } })),
    );
    for (const d of dupes) {
      expect(d.status).toBe(200);
      expect(d.json.idempotent).toBe(true);
    }
    const ents = await apiCall("/api/me/entitlements", undefined, { token: winner });
    const forThisCode = ents.json.items.filter((e: any) => ok[0] && e.id === ok[0].json.entitlement.id);
    expect(forThisCode.length).toBe(1);
  });
});
