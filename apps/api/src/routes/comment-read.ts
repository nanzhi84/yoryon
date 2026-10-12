/** 评论列表读取投影和游标；作品与问答共用同一行为契约，权限由路由先判定。 */
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { comments, commentFeedVersions, memberQuestions, users, type Database } from "@yoryon/db";
import { COMMENT_PAGE_SIZE, toAuthorDto } from "@yoryon/core";
import { uuidRe } from "./questions";
type Tx = Pick<Database, "select">;
type Target = { contentId: string } | { questionId: string };
interface RootCursor { l: number; t: Date; id: string; contentId: string; version: string }
export function decodeRootCursor(raw: string | undefined): RootCursor | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")); const t = new Date(v.t);
    if (typeof v.t !== "string" || Number.isNaN(t.getTime()) || !Number.isInteger(v.l) || v.l < 0 || v.l > 2147483647 || typeof v.id !== "string" || !uuidRe.test(v.id)) return null;
    if (typeof v.contentId !== "string" || !uuidRe.test(v.contentId) || typeof v.version !== "string" || !/^\d{1,19}$/.test(v.version)) return null;
    return { ...v, t } as RootCursor;
  } catch { return null; }
}
export async function loadAuthorMap(tx: Tx, ids: string[]) {
  const rows = ids.length ? await tx.select({ id: users.id, username: users.username, displayName: users.displayName, avatarMediaId: users.avatarMediaId }).from(users).where(inArray(users.id, [...new Set(ids)])) : [];
  return new Map(rows.map(r => [r.id, toAuthorDto(r)]));
}
export async function readRootPage(tx: Tx, target: Target, cursor: RootCursor | null) {
  const targetId = "contentId" in target ? target.contentId : target.questionId;
  const condition = "contentId" in target ? eq(comments.contentId, target.contentId) : eq(comments.questionId, target.questionId);
  const versionRows = "contentId" in target
    ? await tx.select({ version: commentFeedVersions.version }).from(commentFeedVersions).where(eq(commentFeedVersions.contentId, targetId))
    : await tx.select({ version: memberQuestions.discussionVersion }).from(memberQuestions).where(eq(memberQuestions.id, targetId));
  const version = String(versionRows[0]?.version ?? 0n);
  if (cursor && cursor.contentId !== targetId) return { kind: "invalid_cursor" } as const;
  if (cursor && cursor.version !== version) return { kind: "cursor_stale" } as const;
  const keyset = cursor ? or(lt(comments.likeCount, cursor.l), and(eq(comments.likeCount, cursor.l), lt(comments.createdAt, cursor.t)), and(eq(comments.likeCount, cursor.l), eq(comments.createdAt, cursor.t), lt(comments.id, cursor.id))) as SQL : undefined;
  const rows = await tx.select().from(comments).where(and(condition, isNull(comments.parentId), keyset)).orderBy(desc(comments.likeCount), desc(comments.createdAt), desc(comments.id)).limit(COMMENT_PAGE_SIZE + 1);
  const page = rows.slice(0, COMMENT_PAGE_SIZE);
  const [totalRows, replyRows, authors] = await Promise.all([
    tx.select({ count: sql<number>`count(*)::int` }).from(comments).where(and(condition, isNull(comments.parentId))),
    page.length ? tx.select({ parentId: comments.parentId, count: sql<number>`count(*)::int` }).from(comments).where(inArray(comments.parentId, page.map(r => r.id))).groupBy(comments.parentId) : [],
    loadAuthorMap(tx, page.map(r => r.userId)),
  ]);
  const last = page.at(-1);
  return { kind: "ok", data: {
    items: page.map(r => ({ id: r.id, deleted: r.deletedAt !== null, body: r.deletedAt ? null : r.body, likeCount: r.deletedAt ? 0 : r.likeCount,
      createdAt: r.createdAt.toISOString(), author: r.deletedAt ? null : (authors.get(r.userId) ?? null), replyCount: replyRows.find(x => x.parentId === r.id)?.count ?? 0 })),
    total: totalRows[0]?.count ?? 0,
    nextCursor: rows.length > COMMENT_PAGE_SIZE && last ? Buffer.from(JSON.stringify({ l: last.likeCount, t: last.createdAt.toISOString(), id: last.id, contentId: targetId, version })).toString("base64url") : null,
  } } as const;
}
