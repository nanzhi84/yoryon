/**
 * 评论/回复/点赞/站内通知领域逻辑（Issue #14；架构 §7）。
 * 权限规则：写操作要求登录 + 当前对该作品 canAccess（订阅/内容/合集授权/管理员；权益过期撤销即拒）；
 * 读操作公开（已发布作品）。回复挂根评论（parent_id=根），展示扁平化。
 * 例外合同：删除是数据撤回权而非"新的互动"（issue 规则 8），作者/管理员在任何权益状态下可删除。
 *
 * 并发设计：
 * - 互动（回复/点赞）与软删除通过对目标评论行 SELECT ... FOR UPDATE 串行化；取得锁后判定删除态。
 * - 点赞计数只在点赞行实际插入/删除的同一事务内增减；复合主键防双赞；greatest(0,...) 防负。
 * - 通知 eventId 是确定性业务幂等键（sha256 派生 UUID）：like:<commentId>:<actorId>（同一用户对同一评论
 *   的点赞通知只发一次，含取消后重赞——防打扰语义）/ reply:<commentId>（每条回复唯一）。
 * - created_at 由应用层以毫秒精度写入（JS Date），排序/游标直接用原列（索引可用），无需 date_trunc。
 */
import { deterministicUuid } from "./notification-events";
import { and, eq, isNull, sql } from "drizzle-orm";
import { comments, commentLikes, contents, memberQuestions, notifications, users, type Comment, type Content, type Database } from "@yoryon/db";
import { canAccess, type AccessUser } from "./entitlements";
import { hasActiveSubscription } from "./membership";

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

/** 评论目标：作品（按 slug）或会员问答（按 id）。 */
export type CommentTarget = { kind: "content"; slug: string } | { kind: "question"; questionId: string };

type ResolvedTarget = { contentId: string; questionId: null } | { contentId: null; questionId: string };

/** 统计字符数（按 Unicode 码点，代理对算一个字符）。 */
export function commentBodyLength(body: string): number {
  return [...body].length;
}

export function validateCommentBody(body: unknown): body is string {
  if (typeof body !== "string") return false;
  const trimmed = body.trim();
  if (trimmed.length !== body.trim().length) return false;
  const len = commentBodyLength(trimmed);
  return len >= 1 && len <= COMMENT_BODY_MAX;
}

/** 事件通知写入（同事务）；本人操作不通知自己；eventId 业务幂等键防重（重复插入由唯一索引吞掉）。 */
async function insertNotification(
  tx: Tx,
  params: {
    recipientUserId: string;
    actorUserId: string;
    type: "reply" | "like";
    contentId: string | null;
    questionId?: string | null;
    commentId: string;
    eventKey: string;
  },
): Promise<void> {
  if (params.recipientUserId === params.actorUserId) return;
  await tx
    .insert(notifications)
    .values({
      recipientUserId: params.recipientUserId,
      actorUserId: params.actorUserId,
      type: params.type,
      contentId: params.contentId,
      questionId: params.questionId ?? null,
      commentId: params.commentId,
      eventId: deterministicUuid(params.eventKey),
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: notifications.eventId });
}

/** 目标互动权益解析：content=已发布+canAccess；question=公开且未隐藏+有效订阅（或 admin）。 */
async function resolveInteractableTarget(
  tx: Tx,
  user: AccessUser,
  target: CommentTarget,
  now: Date,
): Promise<CommentResult<ResolvedTarget>> {
  if (target.kind === "content") {
    const rows = await tx
      .select({ id: contents.id, visibility: contents.visibility })
      .from(contents)
      .where(and(eq(contents.slug, target.slug), eq(contents.status, "published")))
      .limit(1);
    const content = rows[0];
    if (!content) return { ok: false, error: "content_not_found" };
    if (!(await canAccess(tx, user, content, now))) return { ok: false, error: "forbidden" };
    return { ok: true, value: { contentId: content.id, questionId: null } };
  }
  const rows = await tx
    .select({ id: memberQuestions.id, visibility: memberQuestions.visibility, status: memberQuestions.status })
    .from(memberQuestions)
    .where(eq(memberQuestions.id, target.questionId))
    .limit(1);
  const question = rows[0];
  if (!question) return { ok: false, error: "content_not_found" };
  // 私密问答不允许其他会员参与；隐藏问答关闭互动
  if (question.visibility !== "public" || question.status === "hidden") return { ok: false, error: "forbidden" };
  if (user.role !== "admin" && !(await hasActiveSubscription(tx, user.id, now))) return { ok: false, error: "forbidden" };
  return { ok: true, value: { contentId: null, questionId: question.id } };
}

/**
 * 创建评论/回复。replyToId 存在时：锁目标行后校验（同 target、未删除）；parent_id 取目标所在根（扁平化）。
 */
export async function createComment(
  tx: Tx,
  params: { user: AccessUser; target?: CommentTarget; contentSlug?: string; body: string; replyToId?: string | null; now?: Date },
): Promise<CommentResult<Comment>> {
  if (!validateCommentBody(params.body)) return { ok: false, error: "invalid_body" };
  const target = await resolveInteractableTarget(tx, params.user, params.target ?? { kind: "content", slug: params.contentSlug! }, params.now ?? new Date());
  if (!target.ok) return target;

  let parentId: string | null = null;
  let replyToId: string | null = null;
  if (params.replyToId) {
    // 锁目标行：与并发软删除串行化，取得锁后再判定删除态
    const rows = await tx
      .select({ id: comments.id, parentId: comments.parentId, contentId: comments.contentId, questionId: comments.questionId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, params.replyToId))
      .limit(1)
      .for("update");
    const replyTarget = rows[0];
    const sameTarget = replyTarget && (target.value.contentId ? replyTarget.contentId === target.value.contentId : replyTarget.questionId === target.value.questionId);
    if (!replyTarget || !sameTarget) return { ok: false, error: "reply_target_invalid" };
    if (replyTarget.deletedAt) return { ok: false, error: "reply_target_invalid" };
    // 扁平化：挂在目标所在根评论下；禁止把回复挂到回复的回复形成深层嵌套
    parentId = replyTarget.parentId ?? replyTarget.id;
    replyToId = replyTarget.id;
  }

  const inserted = await tx
    .insert(comments)
    .values({
      contentId: target.value.contentId,
      questionId: target.value.questionId,
      targetKind: target.value.contentId ? "content" : "question",
      userId: params.user.id,
      parentId,
      replyToId,
      body: params.body.trim(),
      createdAt: new Date(),
    })
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
        contentId: target.value.contentId,
        questionId: target.value.questionId,
        commentId: comment.id,
        eventKey: `reply:${comment.id}`,
      });
    }
  }
  return { ok: true, value: comment };
}

/** 锁评论行并校验可互动（存在、未删除、目标仍可互动）。like/unlike 共用前置。 */
async function lockInteractable(
  tx: Tx,
  user: AccessUser,
  commentId: string,
  now: Date,
): Promise<CommentResult<{ comment: Comment }>> {
  const rows = await tx.select().from(comments).where(eq(comments.id, commentId)).limit(1).for("update");
  const comment = rows[0];
  if (!comment || comment.deletedAt) return { ok: false, error: "comment_not_found" };
  if (comment.targetKind === "question") {
    const q = await tx
      .select({ id: memberQuestions.id, visibility: memberQuestions.visibility, status: memberQuestions.status })
      .from(memberQuestions)
      .where(eq(memberQuestions.id, comment.questionId!))
      .limit(1);
    if (!q[0]) return { ok: false, error: "content_not_found" };
    if (q[0].visibility !== "public" || q[0].status === "hidden") return { ok: false, error: "forbidden" };
    if (user.role !== "admin" && !(await hasActiveSubscription(tx, user.id, now))) return { ok: false, error: "forbidden" };
    return { ok: true, value: { comment } };
  }
  const content = await tx
    .select({ id: contents.id, slug: contents.slug, visibility: contents.visibility })
    .from(contents)
    .where(and(eq(contents.id, comment.contentId!), eq(contents.status, "published")))
    .limit(1);
  if (!content[0]) return { ok: false, error: "content_not_found" };
  if (!(await canAccess(tx, user, content[0], now))) return { ok: false, error: "forbidden" };
  return { ok: true, value: { comment } };
}

/** 幂等点赞：已赞时无操作成功。评论行锁串行化并发点赞，返回计数恒为提交后真值。 */
export async function likeComment(
  tx: Tx,
  params: { user: AccessUser; commentId: string; now?: Date },
): Promise<CommentResult<{ likeCount: number }>> {
  const now = params.now ?? new Date();
  const locked = await lockInteractable(tx, params.user, params.commentId, now);
  if (!locked.ok) return locked;

  const inserted = await tx
    .insert(commentLikes)
    .values({ commentId: locked.value.comment.id, userId: params.user.id })
    .onConflictDoNothing({ target: [commentLikes.commentId, commentLikes.userId] })
    .returning({ commentId: commentLikes.commentId });
  if (inserted.length > 0) {
    const updated = await tx
      .update(comments)
      .set({ likeCount: sql`${comments.likeCount} + 1` })
      .where(eq(comments.id, locked.value.comment.id))
      .returning({ likeCount: comments.likeCount });
    await insertNotification(tx, {
      recipientUserId: locked.value.comment.userId,
      actorUserId: params.user.id,
      type: "like",
      contentId: locked.value.comment.contentId,
      questionId: locked.value.comment.questionId,
      commentId: locked.value.comment.id,
      eventKey: `like:${locked.value.comment.id}:${params.user.id}`,
    });
    return { ok: true, value: { likeCount: updated[0]!.likeCount } };
  }
  // 幂等分支：行锁持有期间计数即真值
  return { ok: true, value: { likeCount: locked.value.comment.likeCount } };
}

/** 幂等取消点赞：未赞时无操作成功。取消不撤销已发通知（V1 明确策略）。 */
export async function unlikeComment(
  tx: Tx,
  params: { user: AccessUser; commentId: string; now?: Date },
): Promise<CommentResult<{ likeCount: number }>> {
  const now = params.now ?? new Date();
  const locked = await lockInteractable(tx, params.user, params.commentId, now);
  if (!locked.ok) return locked;

  const deleted = await tx
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, locked.value.comment.id), eq(commentLikes.userId, params.user.id)))
    .returning({ commentId: commentLikes.commentId });
  if (deleted.length > 0) {
    const updated = await tx
      .update(comments)
      .set({ likeCount: sql`greatest(0, ${comments.likeCount} - 1)` })
      .where(eq(comments.id, locked.value.comment.id))
      .returning({ likeCount: comments.likeCount });
    return { ok: true, value: { likeCount: updated[0]!.likeCount } };
  }
  return { ok: true, value: { likeCount: locked.value.comment.likeCount } }; // 幂等：未赞
}

/**
 * 软删除（作者本人或管理员的判定在路由层）。删除是数据撤回权：不校验当前权益/发布状态（issue 规则 8），
 * 权益过期或作品下线后作者仍可撤回自己的评论。
 */
export async function softDeleteComment(tx: Tx, params: { commentId: string; now?: Date }): Promise<CommentResult<Comment>> {
  const updated = await tx
    .update(comments)
    .set({ deletedAt: params.now ?? new Date() })
    .where(and(eq(comments.id, params.commentId), isNull(comments.deletedAt)))
    .returning();
  if (!updated[0]) {
    const rows = await tx.select({ id: comments.id }).from(comments).where(eq(comments.id, params.commentId)).limit(1);
    return rows[0] ? { ok: false, error: "already_deleted" } : { ok: false, error: "comment_not_found" };
  }
  return { ok: true, value: updated[0] };
}

type AuthorRow = { username: string; displayName: string | null; avatarMediaId: string | null };

const AUTHOR_COLS = { username: users.username, displayName: users.displayName, avatarMediaId: users.avatarMediaId };

/** 根评论分页（点赞数 desc, created_at desc, id desc；游标为三元组）。目标二选一：contentId 或 questionId。 */
export async function listRootComments(
  tx: Tx,
  target: { contentId: string } | { questionId: string },
  cursor: { likeCount: number; createdAt: Date; id: string } | null,
  pageSize: number,
): Promise<{ comment: Comment; author: AuthorRow }[]> {
  const conds = [isNull(comments.parentId)];
  if ("contentId" in target) conds.push(eq(comments.contentId, target.contentId));
  else conds.push(eq(comments.questionId, target.questionId));
  if (cursor) {
    conds.push(
      sql`(${comments.likeCount}, ${comments.createdAt}, ${comments.id}) < (${cursor.likeCount}, ${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
    );
  }
  return tx
    .select({ comment: comments, author: AUTHOR_COLS })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(...conds))
    .orderBy(sql`${comments.likeCount} desc, ${comments.createdAt} desc, ${comments.id} desc`)
    .limit(pageSize + 1);
}

/** 回复分页（created_at asc, id asc）。返回 replyTo 作者名（目标已删除/不存在 → null）。 */
export async function listReplies(
  tx: Tx,
  parentId: string,
  cursor: { createdAt: Date; id: string } | null,
  pageSize: number,
): Promise<{ comment: Comment; author: AuthorRow; replyToUsername: string | null }[]> {
  const conds = [eq(comments.parentId, parentId)];
  if (cursor) {
    conds.push(sql`(${comments.createdAt}, ${comments.id}) > (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`);
  }
  const replyToAuthor = sql<string | null>`(
    select case when rc.deleted_at is null then ru.username end
    from comments rc left join users ru on ru.id = rc.user_id
    where rc.id = ${comments.replyToId}
  )`;
  return tx
    .select({ comment: comments, author: AUTHOR_COLS, replyToUsername: replyToAuthor })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(...conds))
    .orderBy(comments.createdAt, comments.id)
    .limit(pageSize + 1);
}

/** 批量查询当前用户对一组评论的点赞态。 */
export async function listLikedCommentIds(tx: Tx, userId: string, commentIds: string[]): Promise<string[]> {
  if (commentIds.length === 0) return [];
  const rows = await tx
    .select({ commentId: commentLikes.commentId })
    .from(commentLikes)
    .where(and(eq(commentLikes.userId, userId), sql`${commentLikes.commentId} = any(${commentIds}::uuid[])`));
  return rows.map((r) => r.commentId);
}

/** 互动权益：已发布内容 + canAccess。写操作统一入口（评论/回复/点赞；删除除外，见 softDeleteComment）。 */
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
