/**
 * 客户端 IP 解析（ADR-0001 §9.5 信任链）：
 * 1. X-BFF-Token 校验通过 → 采用 X-Client-IP（必须可解析为 IP，否则降级）；
 * 2. 否则 → Caddy 覆写后的 X-Forwarded-For（客户端传入值已被 Caddy 丢弃）；
 * 3. 均不可用 → unknown 桶（限流阈值更严）。
 */
import { isIP } from "node:net";
import type { Context, Next } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

export type IpSource = "bff" | "direct" | "unknown";

export interface ClientIp {
  ip: string;
  source: IpSource;
}

export function resolveClientIp(
  headers: { bffToken?: string | undefined; clientIp?: string | undefined; xff?: string | undefined; remoteAddr?: string | undefined },
  expectedBffToken: string,
): ClientIp {
  if (headers.bffToken && headers.bffToken === expectedBffToken) {
    if (headers.clientIp && isIP(headers.clientIp)) {
      return { ip: headers.clientIp, source: "bff" };
    }
    // BFF Token 合法但 X-Client-IP 不可解析 → 降级到 XFF 路径
  }
  if (headers.xff) {
    const first = headers.xff.split(",")[0]?.trim();
    if (first && isIP(first)) return { ip: first, source: "direct" };
  }
  if (headers.remoteAddr && isIP(headers.remoteAddr)) return { ip: headers.remoteAddr, source: "direct" };
  return { ip: "unknown", source: "unknown" };
}

/** Hono 中间件：把解析结果写入 context，供限流与审计日志使用。 */
export function clientIpMiddleware(expectedBffToken: string) {
  return async (c: Context, next: Next) => {
    let remoteAddr: string | undefined;
    try {
      remoteAddr = getConnInfo(c).remote.address ?? undefined;
    } catch {
      remoteAddr = undefined;
    }
    const resolved = resolveClientIp(
      {
        bffToken: c.req.header("x-bff-token"),
        clientIp: c.req.header("x-client-ip"),
        xff: c.req.header("x-forwarded-for"),
        ...(remoteAddr !== undefined ? { remoteAddr } : {}),
      },
      expectedBffToken,
    );
    c.set("clientIp", resolved);
    await next();
  };
}
