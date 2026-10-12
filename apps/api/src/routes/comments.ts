/**
 * 评论 / 回复 / 点赞路由（Issue #14）。
 * - 列表读取公开且不读 session（ADR-0003 公开线，见 auth 中间件白名单）；当前用户点赞状态经私有端点提供。
 * - 写操作：登录 + 当前对该作品 canAccess（权益过期/撤销即 403），事务内维护计数与通知。
 * - 排序：根评论 like_count DESC, created_at DESC, id DESC；回复 created_at ASC, id ASC。游标与排序同一全序。
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { comments, commentFeedVersions, commentLikes, contents, users } from "@yoryon/db";
import {
  COMMENT_BODY_MAX,
  COMMENT_PAGE_SIZE,
  REPLY_PAGE_SIZE,
  createComment,
  likeComment,
  softDeleteComment,
  unlikeComment,
  canAccess,
  toAuthorDto,
  type CommentError,
} from "@yoryon/core";
import { RATE_LIMITS } from "@yoryon/config";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import { requireAuth, type AppVariables } from "../middleware/auth";
import { checkRate } from "./auth";

const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

import { decodeRootCursor, loadAuthorMap, readRootPage } from "./comment-read";
import { questionDiscussionAllowed } from "./question-discussions";

/** 回复游标：(createdAt, id)，时间正序 */
function encodeReplyCursor(t: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id }), "utf8").toString("base64url");
}
function decodeReplyCursor(raw: string | undefined): { t: Date; id: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t: string; id: string };
    const t = new Date(v.t);
    if (Number.isNaN(t.getTime()) || typeof v.id !== "string" || !uuidRe.test(v.id)) return null;
    return { t, id: v.id };
  } catch {
    return null;
  }
}

const createSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX * 4), // 字节级粗限；码点长度由领域层校验
  replyToId: z.string().regex(uuidRe).optional(),
});

const likedSchema = z.object({ ids: z.array(z.string().regex(uuidRe)).max(100) });

function mapCommentError(c: Parameters<typeof errorResponse>[0], error: CommentError): Response {
  switch (error) {
    case "content_not_found":
      return errorResponse(c, 404, "not_found", "内容不存在或未发布");
    case "comment_not_found":
      return errorResponse(c, 404, "not_found", "评论不存在或已删除");
    case "forbidden":
      return errorResponse(c, 403, "forbidden", "当前没有该作品的互动权益");
    case "invalid_body":
      return errorResponse(c, 400, "invalid_body", `评论需为 1-${COMMENT_BODY_MAX} 字纯文本`);
    case "reply_target_invalid":
      return errorResponse(c, 400, "reply_target_invalid", "回复目标无效或已删除");
    case "already_deleted":
      return errorResponse(c, 409, "already_deleted", "评论已删除");
  }
}

export function commentRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  /** 根评论列表（公开；不读 session；公开缓存可 revalidate）。已取消发布作品不公开评论。 */
  app.get("/contents/:slug/comments", async (c) => {
    const slug = c.req.param("slug");
    const rawCursor = c.req.query("cursor");
    const cursor = decodeRootCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效");
    // 版本、排序和 DTO 读取同一数据库快照；排序变化后旧游标明确失效，不能静默漏项。
    const result = await deps.db.transaction(async (tx) => {
      const contentRows = await tx
        .select({ id: contents.id })
        .from(contents)
        .where(and(eq(contents.slug, slug), eq(contents.status, "published")))
        .limit(1);
      const content = contentRows[0];
      if (!content) return { kind: "not_found" } as const;
      return readRootPage(tx, { contentId: content.id }, cursor);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    if (result.kind === "not_found") return errorResponse(c, 404, "not_found", "内容不存在");
    if (result.kind === "invalid_cursor") return errorResponse(c, 400, "invalid_cursor", "分页游标无效");
    if (result.kind === "cursor_stale") return errorResponse(c, 409, "cursor_stale", "评论排序已更新，请重新加载");
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json(result.data);
  });

  /** 回复列表（公开；按根评论分页，时间正序）。 */
  app.get("/comments/:id/replies", async (c) => {
    const rootId = c.req.param("id");
    if (!uuidRe.test(rootId)) return errorResponse(c, 404, "not_found", "评论不存在");
    return deps.db.transaction(async tx => {
    const rootRows = await tx
      .select({ id: comments.id, contentId: comments.contentId, questionId: comments.questionId })
      .from(comments)
      .where(and(eq(comments.id, rootId), isNull(comments.parentId)))
      .limit(1);
    const root = rootRows[0];
    if (!root) return errorResponse(c, 404, "not_found", "评论不存在");
    c.header("Cache-Control", "private, no-store");
    if (root.questionId && !await questionDiscussionAllowed(tx, c.get("auth")?.user ?? null, root.questionId)) return errorResponse(c, 403, "forbidden", "当前不能阅读此问答讨论");
    // 已取消发布的作品不公开评论
    const contentRows = await tx
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.id, root.contentId!), eq(contents.status, "published")))
      .limit(1);
    if (root.contentId && !contentRows[0]) return errorResponse(c, 404, "not_found", "内容不存在");

    const rawCursor = c.req.query("cursor");
    const cursor = decodeReplyCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效");

    const keyset = cursor ? (or(gt(comments.createdAt, cursor.t), and(eq(comments.createdAt, cursor.t), gt(comments.id, cursor.id))) as SQL) : undefined;

    const rows = await tx
      .select()
      .from(comments)
      .where(and(eq(comments.parentId, root.id), keyset))
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .limit(REPLY_PAGE_SIZE + 1);
    const page = rows.slice(0, REPLY_PAGE_SIZE);

    // 被回复对象展示名（@提示）；目标已删除时 username=null，UI 显示「已删除」
    const replyToIds = [...new Set(page.map((r) => r.replyToId).filter((x): x is string => x !== null))];
    const replyToRows = replyToIds.length
      ? await tx.select({ id: comments.id, userId: comments.userId, deletedAt: comments.deletedAt }).from(comments).where(inArray(comments.id, replyToIds))
      : [];
    const authorMap = await loadAuthorMap(tx, [...page.map((r) => r.userId), ...replyToRows.map((r) => r.userId)]);
    const replyToMap = new Map(replyToRows.map((r) => [r.id, r.deletedAt === null ? (authorMap.get(r.userId) ?? null) : null]));

    const last = page[page.length - 1];
    c.header("Cache-Control", "private, no-store");
    return c.json({
      items: page.map((r) => {
        const deleted = r.deletedAt !== null;
        return {
          id: r.id,
          parentId: r.parentId,
          deleted,
          body: deleted ? null : r.body,
          likeCount: deleted ? 0 : r.likeCount,
          createdAt: r.createdAt.toISOString(),
          author: deleted ? null : (authorMap.get(r.userId) ?? null),
          replyTo: r.replyToId ? { id: r.replyToId, username: replyToMap.get(r.replyToId)?.displayName ?? null } : null,
        };
      }),
      nextCursor: rows.length > REPLY_PAGE_SIZE && last ? encodeReplyCursor(last.createdAt, last.id) : null,
    });
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  });

  /** 评论定位（公开）：通知锚点跳转时由客户端展开所属根线程。 */
  app.get("/comments/:id/locate", async (c) => {
    const id = c.req.param("id");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "评论不存在");
    return deps.db.transaction(async tx => {
    const rows = await tx
      .select({ id: comments.id, parentId: comments.parentId, contentId: comments.contentId, questionId: comments.questionId })
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return errorResponse(c, 404, "not_found", "评论不存在");
    c.header("Cache-Control", "private, no-store");
    if (row.questionId) {
      if (!await questionDiscussionAllowed(tx, c.get("auth")?.user ?? null, row.questionId)) return errorResponse(c, 403, "forbidden", "当前不能阅读此问答讨论");
      return c.json({ id: row.id, rootId: row.parentId ?? row.id, questionId: row.questionId });
    }
    // 已取消发布的作品不公开评论定位
    const contentRows = await tx
      .select({ id: contents.id, slug: contents.slug })
      .from(contents)
      .where(and(eq(contents.id, row.contentId!), eq(contents.status, "published")))
      .limit(1);
    if (!contentRows[0]) return errorResponse(c, 404, "not_found", "内容不存在");
    c.header("Cache-Control", "private, no-store");
    return c.json({ id: row.id, rootId: row.parentId ?? row.id, contentSlug: contentRows[0].slug });
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  });

  /** 互动上下文（私有 no-store）：登录态 + 当前互动权益（权益过期/撤销即 false）。 */
  app.get("/contents/:slug/comments/context", async (c) => {
    c.header("Cache-Control", "private, no-store");
    const auth = c.get("auth");
    const contentRows = await deps.db
      .select({ id: contents.id, visibility: contents.visibility })
      .from(contents)
      .where(and(eq(contents.slug, c.req.param("slug")), eq(contents.status, "published")))
      .limit(1);
    const content = contentRows[0];
    if (!content) return errorResponse(c, 404, "not_found", "内容不存在");
    if (!auth) return c.json({ authenticated: false, canInteract: false, me: null });
    const allowed = await canAccess(deps.db, auth.user, content, new Date());
    return c.json({
      authenticated: true,
      canInteract: allowed,
      me: { id: auth.user.id, username: auth.user.username, role: auth.user.role },
    });
  });

  /** 当前用户对一批评论的点赞状态（私有 no-store；未登录返回空集）。 */
  app.get("/comments/liked", async (c) => {
    c.header("Cache-Control", "private, no-store");
    const auth = c.get("auth");
    if (!auth) return c.json({ liked: [] as string[] });
    const parsed = likedSchema.safeParse({ ids: (c.req.query("ids") ?? "").split(",").filter(Boolean) });
    if (!parsed.success) return errorResponse(c, 400, "invalid_request", "参数错误");
    if (parsed.data.ids.length === 0) return c.json({ liked: [] as string[] });
    const rows = await deps.db
      .select({ commentId: commentLikes.commentId })
      .from(commentLikes)
      .where(and(inArray(commentLikes.commentId, parsed.data.ids), eq(commentLikes.userId, auth.user.id)));
    return c.json({ liked: rows.map((r) => r.commentId) });
  });

  /** 发评论/回复（登录 + 互动权益）。 */
  app.post("/contents/:slug/comments", bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => errorResponse(c, 413, "payload_too_large", "评论请求体过大"),
  }), async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [
      { key: `comment:user:${auth.user.id}`, limit: RATE_LIMITS.commentWritePerUserPerMinute, windowMs: 60_000 },
      { key: `comment:ip:${c.get("clientIp").ip}`, limit: RATE_LIMITS.commentWritePerIpPerMinute, windowMs: 60_000 },
    ]);
    if (limited) return limited;

    const body = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");

    const result = await deps.db.transaction(async (tx) =>
      createComment(tx, { user: auth.user, contentSlug: c.req.param("slug"), body: body.data.body, replyToId: body.data.replyToId ?? null }),
    );
    c.header("Cache-Control", "private, no-store");
    if (!result.ok) return mapCommentError(c, result.error);
    const authorName = auth.user.username;
    return c.json({
      id: result.value.id,
      parentId: result.value.parentId,
      createdAt: result.value.createdAt.toISOString(),
      author: toAuthorDto(auth.user),
    });
  });

  /** 软删除：作者本人或管理员。 */
  app.delete("/comments/:id", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const commentId = c.req.param("id");
    if (!uuidRe.test(commentId)) return errorResponse(c, 404, "not_found", "评论不存在");
    const rows = await deps.db.select({ userId: comments.userId }).from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!rows[0]) return errorResponse(c, 404, "not_found", "评论不存在");
    if (rows[0].userId !== auth.user.id && auth.user.role !== "admin") {
      return errorResponse(c, 403, "forbidden", "只能删除自己的评论");
    }
    const result = await deps.db.transaction(async (tx) => softDeleteComment(tx, { commentId }));
    c.header("Cache-Control", "private, no-store");
    if (!result.ok) return mapCommentError(c, result.error);
    return c.json({ ok: true });
  });

  /** 幂等点赞/取消点赞（登录 + 互动权益；本人点赞不产生通知在领域层保证）。 */
  app.put("/comments/:id/like", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [
      { key: `like:user:${auth.user.id}`, limit: RATE_LIMITS.commentLikePerUserPerMinute, windowMs: 60_000 },
    ]);
    if (limited) return limited;
    const commentId = c.req.param("id");
    if (!uuidRe.test(commentId)) return errorResponse(c, 404, "not_found", "评论不存在");
    const result = await deps.db.transaction(async (tx) => likeComment(tx, { user: auth.user, commentId }));
    c.header("Cache-Control", "private, no-store");
    if (!result.ok) return mapCommentError(c, result.error);
    return c.json({ ok: true, likeCount: result.value.likeCount });
  });

  app.delete("/comments/:id/like", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [
      { key: `like:user:${auth.user.id}`, limit: RATE_LIMITS.commentLikePerUserPerMinute, windowMs: 60_000 },
    ]);
    if (limited) return limited;
    const commentId = c.req.param("id");
    if (!uuidRe.test(commentId)) return errorResponse(c, 404, "not_found", "评论不存在");
    const result = await deps.db.transaction(async (tx) => unlikeComment(tx, { user: auth.user, commentId }));
    c.header("Cache-Control", "private, no-store");
    if (!result.ok) return mapCommentError(c, result.error);
    return c.json({ ok: true, likeCount: result.value.likeCount });
  });

  return app;
}
