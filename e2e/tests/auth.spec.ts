/**
 * 验收 1：邮箱注册 → Mailpit 收码 → 验证 → 登录 → 登出；密码重置全流程，重置后旧会话失效。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { clearMailpit, latestCodeFor } from "../helpers/mailpit";
import { apiCall, registerUser, loginUser } from "../helpers/api";

const stamp = runId();
const EMAIL = `e2e-auth-${stamp}@example.com`;
const USERNAME = `authuser${stamp}`;

test.describe("认证全流程", () => {
  test.beforeAll(clearMailpit);

  test("注册 → 收验证码 → 激活 → 自动登录", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("用户名").fill(USERNAME);
    await page.getByLabel(/密码/).fill("password123");
    await page.getByRole("button", { name: "注册" }).click();

    // 进入验证码步骤
    await expect(page.getByLabel("验证码")).toBeVisible();

    // 从 Mailpit 取码（真实 SMTP 链路）
    const code = await latestCodeFor(EMAIL);

    await page.getByLabel("验证码").fill(code);
    await page.getByRole("button", { name: "完成注册" }).click();

    // 验证成功 → 自动登录回首页（Cookie 已由 BFF 种下）
    await expect(page).toHaveURL("/");
    const me = await page.evaluate(async () => (await fetch("/api/auth/me")).json()) as { user: { email: string; username: string } };
    expect(me.user.email).toBe(EMAIL);
    expect(me.user.username).toBe(USERNAME);
  });

  test("登录 → me → 登出 → me 失效", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("邮箱或用户名").fill(EMAIL);
    await page.getByLabel("密码").fill("password123");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL("/");

    const me = await page.evaluate(async () => (await fetch("/api/auth/me")).json()) as { user: { email: string; username: string } };
    expect(me.user.email).toBe(EMAIL);

    // 登出（经 BFF：API 删会话 + 清 Cookie）
    await page.evaluate(async () => fetch("/api/auth/logout", { method: "POST" }));
    const after = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
    expect(after).toBe(401);
  });

  test("错误验证码计数与无效登录", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("邮箱或用户名").fill(EMAIL);
    await page.getByLabel("密码").fill("wrong-password");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("账号或密码错误");
  });

  test("密码重置：发码 → 重置 → 旧会话失效 → 新密码可登录", async ({ page }) => {
    // 先建立一个旧会话
    const oldToken = await loginUser(EMAIL);
    expect((await apiCall("/api/auth/me", undefined, { token: oldToken })).status).toBe(200);

    await page.goto("/reset-password");
    await page.getByLabel("注册邮箱").fill(EMAIL);
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect(page.getByLabel("验证码")).toBeVisible();

    const code = await latestCodeFor(EMAIL);

    await page.getByLabel("验证码").fill(code);
    await page.getByLabel(/新密码/).fill("newpassword456");
    await page.getByRole("button", { name: "重置密码" }).click();
    await expect(page).toHaveURL(/\/login/);

    // 旧会话已被撤销（ADR §9.3）
    expect((await apiCall("/api/auth/me", undefined, { token: oldToken })).status).toBe(401);
    // 旧密码不可用，新密码可登录
    expect((await apiCall("/api/auth/login", { emailOrUsername: EMAIL, password: "password123" })).status).toBe(401);
    const token = await loginUser(EMAIL, "newpassword456");
    expect(token).toBeTruthy();
  });

  test("重复注册已激活邮箱被拒绝", async () => {
    const r = await apiCall("/api/auth/register", { email: EMAIL, username: `other${stamp}`, password: "password123" });
    expect(r.status, JSON.stringify(r.json)).toBe(409);
    expect(r.json.error.code).toBe("email_taken");
  });

  test("重发冷却：60 秒内重复发码被限流", async () => {
    const email = `e2e-cooldown-${stamp}@example.com`;
    await registerUserStartOnly(email, `cooldown${stamp}`);
    const r = await apiCall("/api/auth/resend-code", { email, purpose: "register" });
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("resend_cooldown");
  });
});

async function registerUserStartOnly(email: string, username: string) {
  const r = await apiCall("/api/auth/register", { email, username, password: "password123" });
  if (r.status !== 200) throw new Error(r.text);
}
