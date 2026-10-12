import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { cacheEvents } from "@yoryon/db";
import { verifyCacheSignature } from "@yoryon/config/cache-signing";
import type { AppDeps } from "../deps";
import type { PublicPolicy } from "../public-policy";
import { readBodyCapped } from "@yoryon/core";

/** 只允许已签名且持久化的事件；不经用户 session。 */
export function cacheRoutes(deps: AppDeps, policy: PublicPolicy) {
  const app = new Hono();
  app.get("/public/catalog-policy", async c => { c.header("Cache-Control", "private, no-store"); return c.json({ version: await policy.version() }); });
  app.get("/public/policy/:slug", async c => {
    c.header("Cache-Control", "private, no-store");
    const current = await policy.get(c.req.param("slug"));
    if (!current) return c.json({ error: "not_found" }, 404);
    return c.json(current);
  });
  app.post("/cache/event", async c => {
    c.header("Cache-Control", "private, no-store");
    const body = await readBodyCapped(c.req.raw, 16384);
    if (body === null || !verifyCacheSignature(process.env.CACHE_REVALIDATE_SECRET, c.req.header("x-cache-time") ?? null, c.req.header("x-cache-signature") ?? null, body)) return c.json({ error: "forbidden" }, 403);
    let request: { id: string; payload: string; acknowledge?: boolean };
    try { request = JSON.parse(body); } catch { return c.json({ error: "invalid" }, 400); }
    if (!/^[a-f0-9-]{36}$/.test(request.id)) return c.json({ error: "invalid" }, 400);
    const rows = await deps.db.select().from(cacheEvents).where(eq(cacheEvents.id, request.id)).limit(1);
    const event = rows[0];
    if (!event || event.payload !== request.payload) return c.json({ error: "unknown event" }, 404);
    // 签名事件只能促使读取当前 DB 状态，旧/重复事件无法恢复旧 revision。
    await policy.refresh();
    if (request.acknowledge) await deps.db.update(cacheEvents).set({ invalidatedAt: new Date() }).where(eq(cacheEvents.id, event.id));
    // 未验收事件重试时重新失效，覆盖“确认后 web 进程退出”的窗口。
    return c.json({ invalidated: event.state === "verified" });
  });
  return app;
}
