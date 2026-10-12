/**
 * 评论/回复/点赞/站内通知领域逻辑（Issue #14；架构 §7）。
 * 权限规则：写操作要求登录 + 当前对该作品 canAccess（订阅/内容/合集授权/管理员；权益过期撤销即拒绝）；
 * 读操作公开（已发布作品）。回复挂根评论（parent_id=根），展示扁平化。
 */
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { comments, commentLikes, contents, notifications, type Comment, type Content, type Database } from "@yoryon/db";
import { canAccess, type AccessUser } from "./entitlements";

type Tx = Pick<Database, "select" | "insert" | "update" | "delete">;

export const COMMENT_BODY_MAX = 2000;
/** 根评论/回复分页大小 */
export const COMMENT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 20;

export type CommentError =
  | "content_not_found" // 内容不存在或未发布
  | "comment_not_found"
  | "forbidden" // 当前无该作品互动权益
  | "invalid_body"
  | "reply_target_invalid" // 跨内容 / 自引用 / 目标已删除
  | "already_deleted";

export type CommentResult<T> = { ok: true; value: T } | { ok: false; error: CommentError };

/** 统计字符数（按 Unicode 码点，代理对算一个字符）。 */
export function commentBodyLength(body: string): number {
  return [...body].length;
}

export function validateCommentBody(body: unknown): body is string {
  if (typeof body !== "string") return false;
  const trimmed = body.trim();
  const len = commentBodyLength(trimmed);
  return len >= 1 && len <= COMMENT_BODY_MAX && trimmed.length === body.trim().length;
}

/** 互动权益：已发布内容 + canAccess。写操作统一入口（评论/回复/点赞/删除他人评论除外）。 */
export async function checkCommentable(
  tx: Tx,
  user: AccessUser,
  contentSlug: string,
  now: Date,
): Promise<CommentResult<Pick<Content, "id" | "slug" | "visibility">>> {
  const rows = await tx
    .select({ id: contents.id, slug: contents.slug, visibility: contents.visibility })
    .from(contents)
    .where(and(eq(contents.slug, contentSlug), eq(contents.status, "published")))
    .limit(1);
  const content = rows[0];
  if (!content) return { ok: false, error: "content_not_found" };
  if (!(await canAccess(tx, user, content, now))) return { ok: false, error: "forbidden" };
  return { ok: true, value: content };
}

/** 事件通知写入（同事务）；本人操作不通知自己；eventId 幂等键防重试重复。 */
async function insertNotification(
  tx: Tx,
  params: { recipientUserId: string; actorUserId: string; type: "reply" | "like"; contentId: string; commentId: string },
): Promise<void> {
  if (params.recipientUserId === params.actorUserId) return;
  await tx
    .insert(notifications)
    .values({
      recipientUserId: params.recipientUserId,
      actorUserId: params.actorUserId,
      type: params.type,
      contentId: params.contentId,
      commentId: params.commentId,
      eventId: randomUUID(),
    })
    .onConflictDoNothing({ target: notifications.eventId });
}

/**
 * 创建评论/回复。replyToId 存在时：目标必须同内容、未删除；parent_id 取目标所在根（扁平化）。
 */
export async function createComment(
  tx: Tx,
  params: { user: AccessUser; contentSlug: string; body: string; replyToId?: string | null; now?: Date },
): Promise<CommentResult<Comment>> {
  if (!validateCommentBody(params.body)) return { ok: false, error: "invalid_body" };
  const target = await checkCommentable(tx, params.user, params.contentSlug, params.now ?? new Date());
  if (!target.ok) return target;

  let parentId: string | null = null;
  let replyToId: string | null = null;
  if (params.replyToId) {
    const rows = await tx
      .select({ id: comments.id, parentId: comments.parentId, contentId: comments.contentId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, params.replyToId))
      .limit(1);
    const replyTarget = rows[0];
    if (!replyTarget || replyTarget.contentId !== target.value.id) return { ok: false, error: "reply_target_invalid" };
    if (replyTarget.deletedAt) return { ok: false, error: "reply_target_invalid" };
    // 扁平化：挂在目标所在根评论下；禁止把回复挂到回复的回复形成深层嵌套
    parentId = replyTarget.parentId ?? replyTarget.id;
    replyToId = replyTarget.id;
  }

  const inserted = await tx
    .insert(comments)
    .values({ contentId: target.value.id, userId: params.user.id, parentId, replyToId, body: params.body.trim() })
    .returning();
  const comment = inserted[0]!;

  // 回复通知被回复者（一级评论通知评论作者；本人操作不通知）
  if (replyToId) {
    const targetRows = await tx.select({ userId: comments.userId }).from(comments).where(eq(comments.id, replyToId)).limit(1);
    const recipient = targetRows[0]?.userId;
    if (recipient) {
      await insertNotification(tx, {
        recipientUserId: recipient,
        actorUserId: params.user.id,
        type: "reply",
        contentId: target.value.id,
        commentId: comment.id,
      });
    }
  }
  return { ok: true, value: comment };
}

/** 幂等点赞：已赞时无操作成功。计数与 comment_likes 在同一事务维护。 */
export async function likeComment(
  tx: Tx,
  params: { user: AccessUser; commentId: string; now?: Date },
): Promise<CommentResult<{ likeCount: number }>> {
  const rows = await tx.select().from(comments).where(eq(comments.id, params.commentId)).limit(1);
  const comment = rows[0];
  if (!comment || comment.deletedAt) return { ok: false, error: "comment_not_found" };
  const content = await tx
    .select({ id: contents.id, slug: contents.slug, visibility: contents.visibility })
    .from(contents)
    .where(and(eq(contents.id, comment.contentId), eq(contents.status, "published")))
    .limit(1);
  if (!content[0]) return { ok: false, error: "content_not_found" };
  if (!(await canAccess(tx, params.user, content[0], params.now ?? new Date()))) return { ok: false, error: "forbidden" };

  const inserted = await tx
    .insert(commentLikes)
    .values({ commentId: comment.id, userId: params.user.id })
    .onConflictDoNothing({ target: [commentLikes.commentId, commentLikes.userId] })
    .returning({ commentId: commentLikes.commentId });
  if (inserted.length > 0) {
    const updated = await tx
      .update(comments)
      .set({ likeCount: sql`${comments.likeCount} + 1` })
      .where(eq(comments.id, comment.id))
      .returning({ likeCount: comments.likeCount });
    await insertNotification(tx, {
      recipientUserId: comment.userId,
      actorUserId: params.user.id,
      type: "like",
      contentId: comment.contentId,
      commentId: comment.id,
    });
    return { ok: true, value: { likeCount: updated[0]!.likeCount } };
  }
  return { ok: true, value: { likeCount: comment.likeCount } }; // 幂等：已赞
}

/** 幂等取消点赞：未赞时无操作成功。计数条件更新防负数（check 约束兜底）。 */
export async function unlikeComment(
  tx: Tx,
  params: { user: AccessUser; commentId: string; now?: Date },
): Promise<CommentResult<{ likeCount: number }>> {
  const rows = await tx.select().from(comments).where(eq(comments.id, params.commentId)).limit(1);
  const comment = rows[0];
  if (!comment || comment.deletedAt) return { ok: false, error: "comment_not_found" };
  const content = await tx
    .select({ id: contents.id, slug: contents.slug, visibility: contents.visibility })
    .from(contents)
    .where(and(eq(contents.id, comment.contentId), eq(contents.status, "published")))
    .limit(1);
  if (!content[0]) return { ok: false, error: "content_not_found" };
  if (!(await canAccess(tx, params.user, content[0], params.now ?? new Date()))) return { ok: false, error: "forbidden" };

  const deleted = await tx
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, comment.id), eq(commentLikes.userId, params.user.id)))
    .returning({ commentId: commentLikes.commentId });
  if (deleted.length > 0) {
    const updated = await tx
      .update(comments)
      .set({ likeCount: sql`greatest(0, ${comments.likeCount} - 1)` })
      .where(eq(comments.id, comment.id))
      .returning({ likeCount: comments.likeCount });
    return { ok: true, value: { likeCount: updated[0]!.likeCount } };
  }
  return { ok: true, value: { likeCount: comment.likeCount } }; // 幂等：未赞
}

/** 软删除：作者本人或管理员；返回错误供路由映射（作者判定在路由层完成，这里只做执行）。 */
export async function softDeleteComment(tx: Tx, params: { commentId: string; now?: Date }): Promise<CommentResult<Comment>> {
  const rows = await tx.select().from(comments).where(eq(comments.id, params.commentId)).limit(1);
  const comment = rows[0];
  if (!comment) return { ok: false, error: "comment_not_found" };
  if (comment.deletedAt) return { ok: false, error: "already_deleted" };
  const updated = await tx
    .update(comments)
    .set({ deletedAt: params.now ?? new Date() })
    .where(and(eq(comments.id, comment.id), isNull(comments.deletedAt)))
    .returning();
  return { ok: true, value: updated[0]! };
}
