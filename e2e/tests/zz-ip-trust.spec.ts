/**
 * IP 信任链：伪造 X-Client-IP 无 BFF Token 不生效。
 * 该用例会耗尽 ::1 登录桶，必须字母序最后执行（文件名 zz- 前缀保证）。
 */
import { runId, apiEnv } from "../helpers/env";
import { test, expect } from "@playwright/test";
import { apiCall } from "../helpers/api";
import { clearMailpit } from "../helpers/mailpit";

const stamp = runId();

test.describe("IP 信任", () => {
  test.beforeAll(clearMailpit);
  test("IP 信任：伪造 X-Client-IP 无 BFF Token 不生效；有效 Token 时生效", async () => {
    // 直接连 API，伪造 X-Client-IP（无 BFF token）→ 不采用，限流按真实连接计数。
    // 通过连续触发 login 限流来验证：伪造的 IP 每次不同，若被采用则永远不会 429。
    const scale = Number(apiEnv().RATE_LIMIT_SCALE ?? 1);
    const attempts = 5 * scale + 1;
    let lastStatus = 0;
    for (let i = 0; i < attempts; i++) {
      const r = await apiCall("/api/auth/login", { emailOrUsername: "ipspoof@example.com", password: "x" }, {
        headers: { "x-client-ip": `10.99.0.${i + 1}` },
      });
      lastStatus = r.status;
    }
    // 超过 5×scale 次/分钟（同一真实连接 IP）→ 最后一次被限流
    expect(lastStatus).toBe(429);

    // 持有效 BFF Token 时 X-Client-IP 生效：换一个“客户端 IP”即可避开刚才的桶
    const r = await apiCall("/api/auth/login", { emailOrUsername: "ipspoof@example.com", password: "x" }, { asBff: { clientIp: "10.77.0.1" } });
    expect(r.status).toBe(401); // 未被限流，走到认证逻辑
  });

});
