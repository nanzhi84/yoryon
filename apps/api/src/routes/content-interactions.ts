import { Hono } from "hono";
import { z } from "zod";
import { RATE_LIMITS } from "@yoryon/config";
import { readContentInteractions, setContentLike } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import { requireAuth, type AppVariables } from "../middleware/auth";
import { checkRate } from "./auth";

const idsSchema = z.array(z.string().uuid()).min(1).max(100);

export function contentInteractionRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get("/content-interactions", async c => {
    c.header("Cache-Control", "private, no-store");
    const raw = c.req.query("ids") ?? "";
    const parsed = idsSchema.safeParse(raw.length <= 3700 ? raw.split(",") : []);
    if (!parsed.success) return errorResponse(c, 400, "invalid_ids", "作品列表无效");
    const user = c.get("auth")?.user ?? null;
    const items = await deps.db.transaction(tx => readContentInteractions(tx, [...new Set(parsed.data)], user),
      { isolationLevel: "repeatable read", accessMode: "read only" });
    return c.json({ authenticated: !!user, items });
  });

  async function change(c: Parameters<typeof requireAuth>[0], liked: boolean) {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [{ key: `like:user:${auth.user.id}`,
      limit: RATE_LIMITS.commentLikePerUserPerMinute, windowMs: 60_000 }]);
    if (limited) return limited;
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) return errorResponse(c, 404, "not_found", "内容不存在");
    const result = await deps.db.transaction(tx => setContentLike(tx, { contentId: id.data, user: auth.user, liked }));
    if (!result.ok) return result.error === "not_found"
      ? errorResponse(c, 404, "not_found", "内容不存在或未发布")
      : errorResponse(c, 403, "forbidden", "订阅或兑换此作品后可点赞");
    return c.json(result.value);
  }
  app.put("/content-interactions/:id/like", c => change(c, true));
  app.delete("/content-interactions/:id/like", c => change(c, false));
  return app;
}
