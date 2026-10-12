/**
 * Hono 应用组装。注意中间件顺序与缓存纪律：
 * - 公开线端点（feed/tags）实现中不得读 session（ADR-0003）；
 * - 读 session 的端点一律 private, no-store。
 */
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { ApiError, errorResponse } from "./errors";
import { authMiddleware, type AppVariables } from "./middleware/auth";
import { clientIpMiddleware } from "./middleware/ip";
import type { AppDeps } from "./deps";
import { authRoutes } from "./routes/auth";
import { contentRoutes } from "./routes/contents";
import { mediaRoutes } from "./routes/media";
import { redemptionRoutes } from "./routes/redemptions";
import { analyticsRoutes } from "./routes/analytics";
import { cacheRoutes } from "./routes/cache";
import { commentRoutes } from "./routes/comments";
import { notificationRoutes } from "./routes/notifications";
import { questionDiscussionRoutes } from "./routes/question-discussions";
import { questionRoutes } from "./routes/questions";
import { profileRoutes } from "./routes/profiles";
import { sitemapRoutes } from "./routes/sitemap";
import { createPublicPolicy } from "./public-policy";
import { publicImageRoutes } from "./routes/public-images";
import { referenceRoutes } from "./routes/references";

export function createApp(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.onError((err, c) => {
    if (err instanceof ApiError) return errorResponse(c, err.status as any, err.code, err.message);
    console.error(JSON.stringify({ level: "error", msg: "unhandled error", requestId: c.get("requestId"), err: String(err) }));
    return errorResponse(c, 500, "internal_error", "服务器内部错误");
  });

  // 结构化请求日志：请求 id、用户 id、解析后 IP 与来源、耗时；不记录敏感信息
  app.use("*", async (c, next) => {
    const requestId = randomUUID();
    c.set("requestId", requestId);
    const start = Date.now();
    await next();
    const auth = c.get("auth");
    const ip = c.get("clientIp");
    console.log(
      JSON.stringify({
        level: "info",
        msg: "request",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        userId: auth?.user.id ?? null,
        ip: ip?.ip ?? "unknown",
        ipSource: ip?.source ?? "unknown",
        durationMs: Date.now() - start,
      }),
    );
  });

  app.use("*", clientIpMiddleware(deps.env.BFF_SHARED_SECRET));
  app.use("*", authMiddleware(deps.db));

  app.get("/health", (c) => c.json({ ok: true }));

  app.route("/api/auth", authRoutes(deps));
  const policy = createPublicPolicy(deps.db);
  app.route("/api", contentRoutes(deps, policy));
  app.route("/api", referenceRoutes(deps));
  app.route("/api", mediaRoutes(deps));
  app.route("/api", publicImageRoutes(deps, policy));
  app.route("/api", redemptionRoutes(deps));
  app.route("/api", commentRoutes(deps));
  app.route("/api", notificationRoutes(deps));
  app.route("/api", questionRoutes(deps));
  app.route("/api", questionDiscussionRoutes(deps));
  app.route("/api", profileRoutes(deps));
  app.route("/api", analyticsRoutes(deps));
  app.route("/api", cacheRoutes(deps, policy));
  app.route("/api", sitemapRoutes(deps));

  app.notFound((c) => errorResponse(c, 404, "not_found", "接口不存在"));

  return app;
}
