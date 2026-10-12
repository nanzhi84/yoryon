/** 站内通知路由（Issue #14 V1：reply/like）。全部仅本人可访问，private, no-store。 */
import { Hono } from "hono";
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { comments, contents, notifications, users } from "@yoryon/db";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import { requireAuth, type AppVariables } from "../middleware/auth";

const NOTIFICATION_PAGE_SIZE = 20;
const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** 通知游标：(createdAt, id)，与 ORDER BY created_at DESC, id DESC 同一全序（created_at 应用层毫秒精度写入） */
function encodeCursor(t: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: t.toISOString(), id }), "utf8").toString("base64url");
}
function decodeCursor(raw: string | undefined): { t: Date; id: string } | null {
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

export function notificationRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/notifications", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    c.header("Cache-Control", "private, no-store");

    const rawCursor = c.req.query("cursor");
    const cursor = decodeCursor(rawCursor);
    if (rawCursor && !cursor) return errorResponse(c, 400, "invalid_cursor", "分页游标无效");

    const keyset = cursor
      ? (or(lt(notifications.createdAt, cursor.t), and(eq(notifications.createdAt, cursor.t), lt(notifications.id, cursor.id))) as SQL)
      : undefined;

    const rows = await deps.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, auth.user.id), keyset))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(NOTIFICATION_PAGE_SIZE + 1);
    const page = rows.slice(0, NOTIFICATION_PAGE_SIZE);

    // 展示投影：actor 用户名 + 作品 slug/title（已删除作品/评论 → null，不提供跳转）；绝不含付费正文
    const actorIds = [...new Set(page.map((r) => r.actorUserId))];
    const contentIds = [...new Set(page.map((r) => r.contentId).filter((x): x is string => x !== null))];
    const commentIds = [...new Set(page.map((r) => r.commentId).filter((x): x is string => x !== null))];
    const [actorRows, contentRows, commentRows] = await Promise.all([
      actorIds.length ? deps.db.select({ id: users.id, username: users.username }).from(users).where(inArraySafe(users.id, actorIds)) : [],
      // 仅已发布作品提供跳转与标题；未发布/已删除作品视为已下线，不暴露其当前标题
      contentIds.length
        ? deps.db
            .select({ id: contents.id, slug: contents.slug, title: contents.title })
            .from(contents)
            .where(and(inArraySafe(contents.id, contentIds), eq(contents.status, "published")))
        : [],
      commentIds.length
        ? deps.db.select({ id: comments.id, deletedAt: comments.deletedAt }).from(comments).where(inArraySafe(comments.id, commentIds))
        : [],
    ]);
    const actorMap = new Map(actorRows.map((r) => [r.id, r.username]));
    const contentMap = new Map(contentRows.map((r) => [r.id, { slug: r.slug, title: r.title }]));
    const commentAlive = new Map(commentRows.map((r) => [r.id, r.deletedAt === null]));

    const last = page[page.length - 1];
    return c.json({
      items: page.map((r) => {
        const content = r.contentId ? (contentMap.get(r.contentId) ?? null) : null;
        const alive = r.commentId ? (commentAlive.get(r.commentId) ?? false) : false;
        return {
          id: r.id,
          type: r.type,
          createdAt: r.createdAt.toISOString(),
          readAt: r.readAt?.toISOString() ?? null,
          actor: { username: actorMap.get(r.actorUserId) ?? "用户" },
          // 作品下线或评论删除时不提供跳转
          link: content && alive ? `/p/${content.slug}#comment-${r.commentId}` : null,
          contentTitle: content?.title ?? null,
          commentId: r.commentId,
        };
      }),
      nextCursor: rows.length > NOTIFICATION_PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
    });
  });

  app.get("/notifications/unread-count", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    c.header("Cache-Control", "private, no-store");
    const rows = await deps.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, auth.user.id), isNull(notifications.readAt)));
    return c.json({ count: rows[0]?.count ?? 0 });
  });

  app.patch("/notifications/:id/read", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    c.header("Cache-Control", "private, no-store");
    const id = c.req.param("id");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "通知不存在");
    // 仅本人；幂等（已读重复调用无操作）
    const updated = await deps.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, auth.user.id), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    if (updated.length === 0) {
      const rows = await deps.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, auth.user.id)))
        .limit(1);
      if (!rows[0]) return errorResponse(c, 404, "not_found", "通知不存在");
    }
    return c.json({ ok: true });
  });

  app.post("/notifications/read-all", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    c.header("Cache-Control", "private, no-store");
    await deps.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientUserId, auth.user.id), isNull(notifications.readAt)));
    return c.json({ ok: true });
  });

  return app;
}

/** drizzle inArray 需要非空数组（调用点已保证），这里仅为类型收窄。 */
function inArraySafe(col: any, values: string[]): SQL {
  return inArray(col, values) as SQL;
}
