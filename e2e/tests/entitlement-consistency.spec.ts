/**
 * F09b：canAccess 与 canAccessMany 语义一致性（性能批次一）。
 * 合集详情（批量判定 canAccessMany）与单篇详情（canAccess）必须对同一用户给出相同 access，
 * 覆盖：公开/付费、单篇授权、合集授权、全站订阅、有效期（未生效/已过期）、撤销、admin 特权。
 */
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall, registerUser, withDb } from "../helpers/api";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const COLL_SLUG = `cons-${stamp}`;
const PUBLIC_SLUG = `cons-pub-${stamp}`;
const PAID_SLUGS = [`cons-a-${stamp}`, `cons-b-${stamp}`, `cons-c-${stamp}`];
const ALL_SLUGS = [PUBLIC_SLUG, ...PAID_SLUGS];

async function createCode(args: string[]): Promise<string> {
  const out = await runCliOk(["code", "create", ...args]);
  return /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(out)![1]!;
}

async function redeem(token: string, code: string, ip: string) {
  const r = await apiCall("/api/redemptions", { code }, { token, asBff: { clientIp: ip } });
  expect(r.status).toBe(200);
  return r.json.entitlement.id as string;
}

/** 单篇（canAccess）与合集批量（canAccessMany）两条真实路径的 access 判定必须一致 */
async function expectConsistentAccess(token: string | undefined, expected: Record<string, "full" | "preview">) {
  const opts = token ? { token } : {};
  const coll = await apiCall(`/api/collections/${COLL_SLUG}`, undefined, opts);
  expect(coll.status).toBe(200);
  const batchAccess = new Map<string, string>(coll.json.items.map((i: any) => [i.slug, i.access]));
  for (const slug of ALL_SLUGS) {
    const single = await apiCall(`/api/contents/${slug}`, undefined, opts);
    expect(single.status).toBe(200);
    expect(single.json.access, `${slug} 单篇判定`).toBe(expected[slug]);
    expect(batchAccess.get(slug), `${slug} 批量判定`).toBe(expected[slug]);
  }
}

test.describe.configure({ mode: "serial" });

test.describe("canAccess 与 canAccessMany 语义一致性", () => {
  test.beforeAll(async () => {
    await runCliOk(["collection", "create", COLL_SLUG, "--title", `一致性合集 ${stamp}`]);
    await createPost({ slug: PUBLIC_SLUG, title: "公开成员", visibility: "public", collections: [COLL_SLUG], body: "公开正文" });
    for (const slug of PAID_SLUGS) {
      await createPost({ slug, title: `付费成员 ${slug}`, visibility: "paid", previewMode: "none", collections: [COLL_SLUG], body: `SECRET_${slug}` });
    }
    for (const slug of ALL_SLUGS) {
      await runCliOk(["publish", path.join(E2E.postsRoot, slug)]);
    }
  });

  test("匿名：公开 full / 付费 preview", async () => {
    await expectConsistentAccess(undefined, {
      [PUBLIC_SLUG]: "full",
      [PAID_SLUGS[0]!]: "preview",
      [PAID_SLUGS[1]!]: "preview",
      [PAID_SLUGS[2]!]: "preview",
    });
  });

  test("单篇授权：仅授权篇 full", async () => {
    const token = await registerUser(`e2e-cons1-${stamp}@example.com`, `cons1${stamp}`, "password123", { asBff: { clientIp: "10.90.1.1" } });
    const code = await createCode(["--grant-type", "content", "--content", PAID_SLUGS[0]!, "--count", "1"]);
    await redeem(token, code, "10.90.1.2");
    await expectConsistentAccess(token, {
      [PUBLIC_SLUG]: "full",
      [PAID_SLUGS[0]!]: "full",
      [PAID_SLUGS[1]!]: "preview",
      [PAID_SLUGS[2]!]: "preview",
    });
  });

  test("合集授权：全部付费成员经合集覆盖 full", async () => {
    const token = await registerUser(`e2e-cons2-${stamp}@example.com`, `cons2${stamp}`, "password123", { asBff: { clientIp: "10.90.2.1" } });
    const code = await createCode(["--grant-type", "collection", "--collection", COLL_SLUG, "--count", "1"]);
    await redeem(token, code, "10.90.2.2");
    await expectConsistentAccess(token, Object.fromEntries(ALL_SLUGS.map((s) => [s, "full" as const])));
  });

  test("全站订阅：全部 full", async () => {
    const token = await registerUser(`e2e-cons3-${stamp}@example.com`, `cons3${stamp}`, "password123", { asBff: { clientIp: "10.90.3.1" } });
    const code = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);
    await redeem(token, code, "10.90.3.2");
    await expectConsistentAccess(token, Object.fromEntries(ALL_SLUGS.map((s) => [s, "full" as const])));
  });

  test("有效期约束：未生效 / 已过期 / 已撤销均为 preview", async () => {
    // 未生效（validFrom 在未来）
    const tFuture = await registerUser(`e2e-cons4-${stamp}@example.com`, `cons4${stamp}`, "password123", { asBff: { clientIp: "10.90.4.1" } });
    const codeFuture = await createCode(["--grant-type", "content", "--content", PAID_SLUGS[1]!, "--count", "1"]);
    const entFuture = await redeem(tFuture, codeFuture, "10.90.4.2");
    await withDb(async (db) => {
      await db.query(
        `update entitlements set valid_from = now() + interval '1 day', valid_until = now() + interval '30 days' where id = $1`,
        [entFuture],
      );
    });
    await expectConsistentAccess(tFuture, {
      [PUBLIC_SLUG]: "full",
      [PAID_SLUGS[0]!]: "preview",
      [PAID_SLUGS[1]!]: "preview",
      [PAID_SLUGS[2]!]: "preview",
    });

    // 已过期（绝对时间，不依赖原值——collection 授权 valid_until 恒为 NULL）
    const tExpired = await registerUser(`e2e-cons5-${stamp}@example.com`, `cons5${stamp}`, "password123", { asBff: { clientIp: "10.90.5.1" } });
    const codeExpired = await createCode(["--grant-type", "collection", "--collection", COLL_SLUG, "--count", "1"]);
    const entExpired = await redeem(tExpired, codeExpired, "10.90.5.2");
    await withDb(async (db) => {
      await db.query(
        `update entitlements set valid_from = now() - interval '60 days', valid_until = now() - interval '30 days' where id = $1`,
        [entExpired],
      );
    });
    await expectConsistentAccess(tExpired, Object.fromEntries(ALL_SLUGS.map((s): [string, "full" | "preview"] => [s, s === PUBLIC_SLUG ? "full" : "preview"])));

    // 已撤销
    const tRevoked = await registerUser(`e2e-cons6-${stamp}@example.com`, `cons6${stamp}`, "password123", { asBff: { clientIp: "10.90.6.1" } });
    const codeRevoked = await createCode(["--grant-type", "subscription", "--days", "30", "--count", "1"]);
    const entRevoked = await redeem(tRevoked, codeRevoked, "10.90.6.2");
    await runCliOk(["entitlement", "revoke", entRevoked, "--reason", "consistency test"]);
    await expectConsistentAccess(tRevoked, Object.fromEntries(ALL_SLUGS.map((s): [string, "full" | "preview"] => [s, s === PUBLIC_SLUG ? "full" : "preview"])));
  });

  test("admin 特权：全部 full", async () => {
    const email = `e2e-cons7-${stamp}@example.com`;
    const token = await registerUser(email, `cons7${stamp}`, "password123", { asBff: { clientIp: "10.90.7.1" } });
    await runCliOk(["user", "promote", email]);
    await expectConsistentAccess(token, Object.fromEntries(ALL_SLUGS.map((s) => [s, "full" as const])));
  });
});
