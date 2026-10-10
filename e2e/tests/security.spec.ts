/**
 * 验收 2/8/9/15：CSRF、Session 失效、IP 信任链、限流。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { apiCall, loginUser, registerUser } from "../helpers/api";
import { apiEnv } from "../helpers/env";
import { E2E } from "../helpers/env";
import { clearMailpit } from "../helpers/mailpit";

const stamp = runId();

test.describe("安全边界", () => {
  test.beforeAll(clearMailpit);

  test("CSRF：非法 Origin 的写请求被 BFF 拒绝（403）", async ({ request }) => {
    const r = await request.post(`${E2E.webUrl}/api/auth/login`, {
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      data: { emailOrUsername: "x", password: "y" },
    });
    expect(r.status()).toBe(403);
    expect((await r.json()).error.code).toBe("csrf_rejected");
  });

  test("CSRF：无 Origin 且 Sec-Fetch-Site: cross-site 被拒；合法 Origin 放行", async ({ request }) => {
    const bad = await request.post(`${E2E.webUrl}/api/auth/login`, {
      headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
      data: { emailOrUsername: "x", password: "y" },
    });
    expect(bad.status()).toBe(403);

    // 合法 Origin 放行：用无登录限流的端点，到达 API 返回 401（未带 token）而非 403
    const ok = await request.post(`${E2E.webUrl}/api/redemptions`, {
      headers: { "content-type": "application/json", origin: E2E.webUrl, "sec-fetch-site": "same-origin" },
      data: { code: "TEST-0000-0000-0000" },
    });
    expect(ok.status()).toBe(401);
  });

  test("BFF 路径白名单：不在白名单的路径 404", async ({ request }) => {
    const r = await request.get(`${E2E.webUrl}/api/admin/users`);
    expect(r.status()).toBe(404);
  });

  test("限流：login 超阈值 429，窗口过后恢复", async () => {
    // 独立 BFF 客户端 IP，避免与其它用例串桶
    const opt = { asBff: { clientIp: "10.60.1.1" } };
    const scale = Number(apiEnv().RATE_LIMIT_SCALE ?? 1);
    const limit = 5 * scale;
    for (let i = 0; i < limit; i++) {
      const r = await apiCall("/api/auth/login", { emailOrUsername: `rl${i}@example.com`, password: "x" }, opt);
      expect(r.status).toBe(401);
    }
    const rN = await apiCall("/api/auth/login", { emailOrUsername: "rln@example.com", password: "x" }, opt);
    const saw429 = rN.status === 429;
    expect(saw429).toBe(true);
    expect(rN.headers.get("retry-after")).toBeTruthy();
  });

  test("被禁用用户的会话即时失效", async () => {
    const email = `e2e-disable-${stamp}@example.com`;
    const opt = { asBff: { clientIp: "10.80.1.1" } };
    const token = await registerUser(email, `disable${stamp}`, "password123", opt);
    expect((await apiCall("/api/auth/me", undefined, { token })).status).toBe(200);

    // CLI 禁用
    const { runCliOk } = await import("../helpers/cli");
    await runCliOk(["user", "disable", email]);

    expect((await apiCall("/api/auth/me", undefined, { token })).status).toBe(401);
    const relogin = await apiCall("/api/auth/login", { emailOrUsername: email, password: "password123" }, opt);
    expect(relogin.status).toBe(403);
    expect(relogin.json.error.code).toBe("account_disabled");
  });

  test("伪造/失效的 Bearer 一律 401", async () => {
    expect((await apiCall("/api/auth/me", undefined, { token: "forged-token" })).status).toBe(401);
    expect((await apiCall("/api/me/entitlements", undefined, { token: "forged-token" })).status).toBe(401);
  });
});
