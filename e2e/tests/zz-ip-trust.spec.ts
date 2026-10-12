/**
 * IP 信任链：伪造 X-Client-IP 无 BFF Token 不生效。
 * 经过独立 Caddy 入口，避免与全套测试共用 ::1 的旧限流窗口。
 */
import { runId, apiEnv, E2E } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { apiCall } from "../helpers/api";
import { clearMailpit } from "../helpers/mailpit";

const stamp = runId();

test.describe("IP 信任", () => {
  test.beforeAll(clearMailpit);
  test("IP 信任：伪造 X-Client-IP 无 BFF Token 不生效；有效 Token 时生效", async () => {
    // 经真实 Caddy，伪造 X-Client-IP / XFF（无 BFF token）→ 不采用。
    // 通过连续触发 login 限流来验证：伪造的 IP 每次不同，若被采用则永远不会 429。
    const scale = Number(apiEnv().RATE_LIMIT_SCALE ?? 1);
    const attempts = 5 * scale + 1;
    let lastStatus = 0;
    for (let i = 0; i < attempts; i++) {
      // 每次换账号，避免账号限流误充当 IP 限流的证据。
      const r = await fetch(`${E2E.caddyUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-ip": `10.99.0.${i + 1}`,
          "x-forwarded-for": `10.98.0.${i + 1}`,
        },
        body: JSON.stringify({ emailOrUsername: `ipspoof-${stamp}-${i}@example.com`, password: "x" }),
      });
      lastStatus = r.status;
      await r.arrayBuffer();
    }
    // 超过 5×scale 次/分钟（同一真实连接 IP）→ 最后一次被限流
    expect(lastStatus).toBe(429);

    // 持有效 BFF Token 时 X-Client-IP 生效：换一个“客户端 IP”即可避开刚才的桶
    const r = await apiCall("/api/auth/login", { emailOrUsername: `ipspoof-${stamp}-trusted@example.com`, password: "x" }, { asBff: { clientIp: "10.77.0.1" } });
    expect(r.status).toBe(401); // 未被限流，走到认证逻辑
  });

});
