import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { comments, contentLikes, contents, type Database } from "@yoryon/db";
import { canAccess, canAccessMany, type AccessUser } from "./entitlements";

type Tx = Pick<Database, "select" | "insert" | "update" | "delete">;

/** 身份相关的互动统计不进入公开内容快照；只投影已发布作品的聚合值。 */
export async function readContentInteractions(tx: Tx, ids: string[], user: AccessUser | null) {
  const rows = await tx.select({ id: contents.id, visibility: contents.visibility }).from(contents)
    .where(and(inArray(contents.id, ids), eq(contents.status, "published")));
  if (!rows.length) return [];
  const visibleIds = rows.map(row => row.id);
  const [access, likes, commentCounts] = await Promise.all([
    canAccessMany(tx, user, rows, new Date()),
    tx.select({ id: contentLikes.contentId, count: sql<number>`count(*)::int`,
      liked: user ? sql<boolean>`bool_or(${contentLikes.userId} = ${user.id})` : sql<boolean>`false` })
      .from(contentLikes).where(inArray(contentLikes.contentId, visibleIds)).groupBy(contentLikes.contentId),
    tx.select({ id: comments.contentId, count: sql<number>`count(*)::int` }).from(comments)
      .where(and(inArray(comments.contentId, visibleIds), isNull(comments.deletedAt))).groupBy(comments.contentId),
  ]);
  const likeMap = new Map(likes.map(row => [row.id, row]));
  const commentMap = new Map(commentCounts.map(row => [row.id, row.count]));
  return rows.map(row => ({ id: row.id, commentCount: commentMap.get(row.id) ?? 0,
    likeCount: likeMap.get(row.id)?.count ?? 0, liked: likeMap.get(row.id)?.liked ?? false,
    canLike: !!user && !!access.get(row.id) }));
}

/** 行锁串行化同一作品的并发修改；不维护另一个可能漂移的赞数列。 */
export async function setContentLike(tx: Tx, params: { contentId: string; user: AccessUser; liked: boolean }) {
  const [content] = await tx.select({ id: contents.id, visibility: contents.visibility, status: contents.status })
    .from(contents).where(eq(contents.id, params.contentId)).for("update");
  if (!content || content.status !== "published") return { ok: false, error: "not_found" } as const;
  if (!await canAccess(tx, params.user, content, new Date())) return { ok: false, error: "forbidden" } as const;
  if (params.liked) {
    await tx.insert(contentLikes).values({ contentId: content.id, userId: params.user.id }).onConflictDoNothing();
  } else {
    await tx.delete(contentLikes).where(and(eq(contentLikes.contentId, content.id), eq(contentLikes.userId, params.user.id)));
  }
  const [count] = await tx.select({ value: sql<number>`count(*)::int` }).from(contentLikes).where(eq(contentLikes.contentId, content.id));
  return { ok: true, value: { likeCount: count!.value, liked: params.liked } } as const;
}
