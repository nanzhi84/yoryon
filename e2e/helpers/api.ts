/** 直连 API 的辅助（可模拟 BFF 头或直接连接），以及 DB 直查。 */
import pg from "pg";
import { E2E } from "./env";

export interface ApiCallOptions {
  /** 模拟经 BFF 转发：附带有效 X-BFF-Token 与指定客户端 IP */
  asBff?: { clientIp: string };
  token?: string;
  origin?: string;
  method?: string;
  headers?: Record<string, string>;
}

export async function apiCall(path: string, body?: unknown, opts: ApiCallOptions = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.origin) headers["origin"] = opts.origin;
  if (opts.asBff) {
    headers["x-bff-token"] = E2E.bffSecret;
    headers["x-client-ip"] = opts.asBff.clientIp;
  }
  const res = await fetch(`${E2E.apiUrl}${path}`, {
    method: opts.method ?? (body !== undefined ? "POST" : "GET"),
    headers,
    body: body !== undefined ? JSON.stringify(body) : null,
    redirect: "manual",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 302 等非 JSON */
  }
  return { status: res.status, json, headers: res.headers, text };
}

/** 注册并激活（直连 API），返回 bearer token。 */
export async function registerUser(email: string, username: string, password = "password123", opts: ApiCallOptions = {}): Promise<string> {
  const r1 = await apiCall("/api/auth/register", { email, username, password }, opts);
  if (r1.status !== 200) throw new Error(`register failed: ${r1.text}`);
  const { latestCodeFor } = await import("./mailpit");
  const code = await latestCodeFor(email);
  const r2 = await apiCall("/api/auth/verify-email", { email, code }, opts);
  if (r2.status !== 200) throw new Error(`verify failed: ${r2.text}`);
  return r2.json.token as string;
}

export async function loginUser(emailOrUsername: string, password = "password123", opts: ApiCallOptions = {}): Promise<string> {
  const r = await apiCall("/api/auth/login", { emailOrUsername, password }, opts);
  if (r.status !== 200) throw new Error(`login failed: ${r.text}`);
  return r.json.token as string;
}

/** 直连测试库（数据准备/时间偏移断言）。 */
export function testDb(): pg.Client {
  return new pg.Client({ connectionString: E2E.databaseUrl });
}

export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = testDb();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
