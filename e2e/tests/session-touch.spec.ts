/**
 * F05a：session lastUsedAt 条件写入（性能批次一）。
 * - 登录态高频请求：阈值窗口内不重复 UPDATE（消除写放大），超过阈值后才再次写入；
 * - 匿名请求（无 Cookie/Bearer）：公开接口响应无 Set-Cookie，不产生任何 session 写入。
 */
import { test, expect } from "@playwright/test";
import { apiCall, registerUser, withDb } from "../helpers/api";
import { E2E, runId } from "../helpers/env";

const stamp = runId();
const EMAIL = `e2e-touch-${stamp}@example.com`;

async function lastUsedAt(): Promise<Date | null> {
  return withDb(async (db) => {
    const r = await db.query(
      `select s.last_used_at from sessions s join users u on u.id = s.user_id
       where u.email = $1 order by s.created_at desc limit 1`,
      [EMAIL],
    );
    return (r.rows[0]?.last_used_at as Date | null) ?? null;
  });
}

test("登录态高频请求下 lastUsedAt 写入被节流", async () => {
  const token = await registerUser(EMAIL, `touch${stamp}`, "password123", { asBff: { clientIp: "10.80.1.1" } });

  // 首次认证请求：last_used_at 从 NULL → 写入
  expect((await apiCall("/api/auth/me", undefined, { token })).status).toBe(200);
  const first = await lastUsedAt();
  expect(first).not.toBeNull();

  // 阈值窗口内的高频请求：不再 UPDATE（值不变）
  for (let i = 0; i < 3; i++) {
    expect((await apiCall("/api/auth/me", undefined, { token })).status).toBe(200);
  }
  expect((await lastUsedAt())?.getTime()).toBe(first!.getTime());

  // 模拟距上次记录已超过阈值 → 下一次请求重新写入
  await withDb(async (db) => {
    await db.query(
      `update sessions s set last_used_at = now() - interval '5 minutes'
       from users u where s.user_id = u.id and u.email = $1`,
      [EMAIL],
    );
  });
  expect((await apiCall("/api/auth/me", undefined, { token })).status).toBe(200);
  const after = await lastUsedAt();
  expect(after).not.toBeNull();
  expect(after!.getTime()).toBeGreaterThan(Date.now() - 60_000);
});

test("续期不被 touch 节流吞掉：近期 touch 且剩余 <15 天时仍续期并通知 BFF", async () => {
  const email = `e2e-renew-${stamp}@example.com`;
  const token = await registerUser(email, `renew${stamp}`, "password123", { asBff: { clientIp: "10.80.2.1" } });
  // last_used_at 近期（节流窗口内，touch 分支本不应写库），但剩余有效期压到续期阈值内
  await withDb(async (db) => {
    await db.query(
      `update sessions s set expires_at = now() + interval '7 days', last_used_at = now()
       from users u where s.user_id = u.id and u.email = $1`,
      [email],
    );
  });
  const res = await apiCall("/api/auth/me", undefined, { token });
  expect(res.status).toBe(200);
  // 续期分支独立：仍更新 expires_at 并经 x-session-expires 通知 BFF 重设 Cookie
  const renewed = res.headers.get("x-session-expires");
  expect(renewed).toBeTruthy();
  expect(new Date(renewed!).getTime()).toBeGreaterThan(Date.now() + 25 * 24 * 60 * 60 * 1000);
});

test("匿名公开接口无 Set-Cookie（无任何 session 写入路径）", async ({ request }) => {
  for (const path of ["/api/feed", "/api/collections", "/api/tags/nonexistent-tag"]) {
    const res = await request.get(`${E2E.webUrl}${path}`);
    expect(res.headers()["set-cookie"]).toBeUndefined();
    expect(res.headers()["x-session-expires"]).toBeUndefined();
  }
});
