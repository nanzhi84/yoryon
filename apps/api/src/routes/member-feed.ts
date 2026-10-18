/** 订阅目录：合集聚合与无合集会员作品；只返回公开元数据/预览，不推断阅读权益。 */
import { Hono } from "hono";
import { eq, inArray, sql } from "drizzle-orm";
import { contents, contentTags, tags } from "@yoryon/db";
import { z } from "zod";
import { articleFeedSummaries } from "./article-feed";
import { postFeedBodies } from "./post-feed";
import type { AppDeps } from "../deps";
import type { PublicPolicy } from "../public-policy";
import type { AppVariables } from "../middleware/auth";
import { errorResponse } from "../errors";

const PAGE_SIZE = 20;
const cursorSchema = z.object({ t: z.string().datetime(), id: z.string().uuid(), kind: z.enum(["collection", "content"]) });
const entrySchema = z.object({ id: z.string().uuid(), kind: z.enum(["collection", "content"]), sortAt: z.coerce.date(),
  slug: z.string(), title: z.string(), description: z.string(), visibility: z.enum(["public", "paid"]),
  coverMediaId: z.string().uuid().nullable(), itemCount: z.number().int().nonnegative(), paidItemCount: z.number().int().nonnegative(),
  isPinned: z.boolean(), updatedAt: z.coerce.date() });
type Entry = z.infer<typeof entrySchema>;

export function memberFeedRoutes(deps: AppDeps, policy: PublicPolicy) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get("/member-feed", async c => deps.db.transaction(async tx => {
    const version = await policy.version("member-feed", tx);
    if (c.req.query("version") && c.req.query("version") !== version) return errorResponse(c, 409, "snapshot_expired", "列表已更新，请刷新页面");
    const raw = c.req.query("cursor");
    let cursor: z.infer<typeof cursorSchema> | null = null;
    if (raw) {
      try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))); }
      catch { return errorResponse(c, 400, "invalid_cursor", "分页游标无效，请刷新列表"); }
    }
    // 先按合集聚合，再与独立作品合并分页，不能对一页文章做客户端分组。
    // 同一作品属于多个合集时，各合集独立出现；该作品不再另列单篇。
    const result = await tx.execute<Entry>(sql`
      with entries as (
        select c.id, 'collection'::text as kind, date_trunc('milliseconds', c.updated_at) as "sortAt",
          c.slug, c.title, c.description, c.visibility, c.cover_media_id as "coverMediaId",
          count(*)::int as "itemCount", count(*) filter (where w.visibility = 'paid')::int as "paidItemCount",
          c.is_pinned as "isPinned", c.updated_at as "updatedAt"
        from collections c join collection_items ci on ci.collection_id = c.id
          join contents w on w.id = ci.content_id and w.status = 'published' and w.type = 'article'
        group by c.id having count(*) filter (where w.visibility = 'paid') > 0
        union all
        select w.id, 'content'::text, date_trunc('milliseconds', coalesce(w.published_at, w.created_at)),
          w.slug, w.title, w.description, w.visibility, w.cover_media_id, 0, 0, w.is_pinned, w.updated_at
        from contents w where w.status = 'published' and w.visibility = 'paid'
          and (w.type = 'post' or not exists (select 1 from collection_items ci where ci.content_id = w.id))
      ) select * from entries
      ${cursor ? sql`where ("sortAt", id, kind) < (${cursor.t}::timestamptz, ${cursor.id}::uuid, ${cursor.kind}::text)` : sql``}
      order by "sortAt" desc, id desc, kind desc limit ${PAGE_SIZE + 1}
    `);
    // Raw SQL 不经过 Drizzle 的 timestamp 映射；在持久化边界统一校验与转换。
    const entries = z.array(entrySchema).parse(result.rows);
    const page = entries.slice(0, PAGE_SIZE);
    const ids = page.filter(row => row.kind === "content").map(row => row.id);
    const rows = ids.length ? await tx.select({ id: contents.id, type: contents.type, publishedAt: contents.publishedAt })
      .from(contents).where(inArray(contents.id, ids)) : [];
    const tagRows = ids.length ? await tx.select({ contentId: contentTags.contentId, slug: tags.slug, name: tags.name })
      .from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(inArray(contentTags.contentId, ids)) : [];
    const bodies = await postFeedBodies(tx, rows.filter(row => row.type === "post").map(row => row.id), deps.env.MEDIA_BLOCK_WEIGHT);
    const summaries = await articleFeedSummaries(tx, rows.filter(row => row.type === "article").map(row => row.id), deps.env.MEDIA_BLOCK_WEIGHT);
    const last = page.at(-1);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({ version, items: page.map(row => row.kind === "collection" ? {
      kind: row.kind, id: row.id, slug: row.slug, title: row.title, description: row.description, visibility: row.visibility,
      coverMediaId: row.coverMediaId, itemCount: row.itemCount, paidItemCount: row.paidItemCount, isPinned: row.isPinned,
      updatedAt: row.updatedAt.toISOString(),
    } : {
      kind: row.kind, id: row.id, slug: row.slug, title: row.title, description: row.description, visibility: row.visibility,
      coverMediaId: row.coverMediaId, isPinned: row.isPinned, type: rows.find(content => content.id === row.id)!.type,
      publishedAt: rows.find(content => content.id === row.id)!.publishedAt?.toISOString() ?? null,
      excerpt: summaries.get(row.id)?.excerpt ?? "", readerLayout: summaries.get(row.id)?.layout ?? null,
      post: bodies.get(row.id) ?? null, tags: tagRows.filter(tag => tag.contentId === row.id).map(tag => ({ slug: tag.slug, name: tag.name })),
    }), nextCursor: result.rows.length > PAGE_SIZE && last ? Buffer.from(JSON.stringify({ t: last.sortAt.toISOString(), id: last.id, kind: last.kind })).toString("base64url") : null });
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));
  return app;
}
