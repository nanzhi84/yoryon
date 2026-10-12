/**
 * 媒体访问控制（ADR-0004 + ADR-0006 + ADR-0003 修订）。
 * GET /api/media/:id 的放行规则（满足任一）：
 *   1. 任一已发布内容的封面，或任一合集的封面 → 免费（身份无关）
 *   2. 任一已发布内容中 exposure='free' → 免费（身份无关）
 *   3. 当前用户对任一引用该媒体的已发布内容通过 canAccess → 私有放行
 *   4. 否则 403
 */
import { and, eq, or } from "drizzle-orm";
import { collections, contentMedia, contents, mediaAssets, users, type MediaAsset } from "@yoryon/db";
import type { Database } from "@yoryon/db";
import { canAccess, type AccessUser } from "./entitlements";

type Tx = Pick<Database, "select">;

export type MediaAccess =
  | { allow: true; via: "cover" | "free" } // 身份无关 → 302 可共享缓存
  | { allow: true; via: "entitlement" } // 权益命中 → private, no-store
  | { allow: false };

export async function resolveMediaAccess(tx: Tx, mediaId: string, user: AccessUser | null, now: Date): Promise<MediaAccess> {
  // 规则 1：封面
  const coverHits = await tx
    .select({ id: contents.id })
    .from(contents)
    .where(and(eq(contents.coverMediaId, mediaId), eq(contents.status, "published")))
    .limit(1);
  if (coverHits.length > 0) return { allow: true, via: "cover" };

  const collectionCovers = await tx.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, mediaId)).limit(1);
  if (collectionCovers.length > 0) return { allow: true, via: "cover" };

  // 规则 2：已发布内容中 exposure='free'
  const freeHits = await tx
    .select({ id: contents.id })
    .from(contentMedia)
    .innerJoin(contents, eq(contentMedia.contentId, contents.id))
    .where(and(eq(contentMedia.mediaId, mediaId), eq(contentMedia.exposure, "free"), eq(contents.status, "published")))
    .limit(1);
  if (freeHits.length > 0) return { allow: true, via: "free" };

  // 规则 3：权益
  if (user) {
    const referencing = await tx
      .select({ id: contents.id, visibility: contents.visibility })
      .from(contentMedia)
      .innerJoin(contents, eq(contentMedia.contentId, contents.id))
      .where(and(eq(contentMedia.mediaId, mediaId), eq(contents.status, "published")));
    // 封面引用的内容也计入（封面本身只放行了免费身份，付费内容的封面经由规则 1 已返回）
    const coverContents = await tx
      .select({ id: contents.id, visibility: contents.visibility })
      .from(contents)
      .where(and(eq(contents.coverMediaId, mediaId), eq(contents.status, "published")));
    const candidates = [...referencing, ...coverContents.filter((c) => !referencing.some((r) => r.id === c.id))];
    for (const c of candidates) {
      if (await canAccess(tx as Pick<Database, "select" | "insert" | "update">, user, c, now)) return { allow: true, via: "entitlement" };
    }
  }

  return { allow: false };
}

export async function findMediaById(tx: Tx, mediaId: string): Promise<MediaAsset | null> {
  const rows = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId)).limit(1);
  return rows[0] ?? null;
}

/** 引用计数（GC 复核用）：content_media 边 + 内容封面 + 合集封面。 */
export async function countMediaReferences(tx: Tx, mediaId: string): Promise<number> {
  const edges = await tx.select({ contentId: contentMedia.contentId }).from(contentMedia).where(eq(contentMedia.mediaId, mediaId));
  const cover1 = await tx.select({ id: contents.id }).from(contents).where(eq(contents.coverMediaId, mediaId));
  const cover2 = await tx.select({ id: collections.id }).from(collections).where(eq(collections.coverMediaId, mediaId));
  const avatars = await tx.select({ id: users.id }).from(users).where(eq(users.avatarMediaId, mediaId));
  return edges.length + cover1.length + cover2.length + avatars.length;
}
