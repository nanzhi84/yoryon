import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { memberQuestions, type Database } from "@yoryon/db";
import { createComment, hasActiveSubscription, validateCommentBody, toAuthorDto, type AccessUser } from "@yoryon/core";
import { RATE_LIMITS } from "@yoryon/config";
import type { AppDeps } from "../deps";
import type { AppVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { errorResponse } from "../errors";
import { uuidRe } from "./questions";
import { checkRate } from "./auth";
import { decodeRootCursor, readRootPage } from "./comment-read";

/** 所有问答评论读取入口复用：私密/隐藏关闭讨论，历史提问者没有额外讨论权限。 */
export async function questionDiscussionAllowed(tx: Pick<Database, "select">, viewer: AccessUser | null, id: string) {
  if (!viewer) return false;
  const rows = await tx.select({ id: memberQuestions.id }).from(memberQuestions).where(and(eq(memberQuestions.id, id), eq(memberQuestions.visibility, "public"), ne(memberQuestions.status, "hidden"))).limit(1);
  return !!rows[0] && (viewer.role === "admin" || await hasActiveSubscription(tx, viewer.id, new Date()));
}
export function questionDiscussionRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  app.get("/questions/:id/comments", async c => {
    const id = c.req.param("id"); const auth = c.get("auth");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "问答不存在");
    const raw = c.req.query("cursor"); const cursor = decodeRootCursor(raw);
    if (raw && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效");
    return deps.db.transaction(async tx => {
      if (!await questionDiscussionAllowed(tx, auth?.user ?? null, id)) return errorResponse(c, 403, "forbidden", "当前不能阅读此问答讨论");
      const result = await readRootPage(tx, { questionId: id }, cursor);
      if (result.kind !== "ok") return errorResponse(c, result.kind === "cursor_stale" ? 409 : 400, result.kind, "评论排序已更新，请刷新列表");
      return c.json(result.data);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  });
  app.get("/questions/:id/comments/context", async c => {
    const auth = c.get("auth"); const id = c.req.param("id");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "问答不存在");
    return c.json({ authenticated: !!auth, canInteract: await questionDiscussionAllowed(deps.db, auth?.user ?? null, id),
      me: auth ? { id: auth.user.id, ...toAuthorDto(auth.user), role: auth.user.role } : null });
  });
  app.post("/questions/:id/comments", bodyLimit({ maxSize: 32 * 1024, onError: c => errorResponse(c, 413, "payload_too_large", "请求体过大") }), async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const id = c.req.param("id"); if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "问答不存在");
    const limited = checkRate(deps, c, [{ key: `comment:user:${auth.user.id}`, limit: RATE_LIMITS.commentWritePerUserPerMinute, windowMs: 60_000 }]);
    if (limited) return limited;
    const body = await c.req.json().catch(() => null) as { body?: unknown; replyToId?: unknown } | null;
    if (!body || !validateCommentBody(body.body) || (body.replyToId !== undefined && (typeof body.replyToId !== "string" || !uuidRe.test(body.replyToId)))) return errorResponse(c, 400, "invalid_body", "评论需为 1-2000 字，回复目标需为有效 id");
    const result = await deps.db.transaction(tx => createComment(tx, { user: auth.user, target: { kind: "question", questionId: id }, body: body.body as string, replyToId: body.replyToId as string | undefined ?? null }));
    if (!result.ok) return errorResponse(c, result.error === "forbidden" ? 403 : 400, result.error, "当前无法发布评论，请核对会员资格与回复目标");
    return c.json({ id: result.value.id, parentId: result.value.parentId, createdAt: result.value.createdAt.toISOString(), author: toAuthorDto(auth.user) }, 201);
  });
  return app;
}
