import { and, eq } from "drizzle-orm";
import { collectionItems, collections, contents, contentMedia, contentTags, mediaAssets, tags } from "@yoryon/db";
import { canAccess, publicPreview, filterStoredMediaRefs, parseMarkdown, stringifyMarkdown, type AccessUser } from "@yoryon/core";
import { collectionNavigation } from "./content-navigation";
import type { AppDeps } from "../deps";

/** 领域到公开/私有 DTO 的唯一投影。公开入口传 null，且从不读取 session。 */
export async function loadContentDetail(deps: AppDeps, slug: string, viewer: AccessUser | null) {
    const rows = await deps.db.select().from(contents).where(and(eq(contents.slug, slug), eq(contents.status, "published"))).limit(1);
    const content = rows[0];
    if (!content) return null;

    // 关联查询并行化（F10a）：权益判定与 tags/media/collections 互不依赖，一个往返窗口完成
    const [fullAccess, tagRows, mediaRows, collectionRows] = await Promise.all([
      canAccess(deps.db, viewer, content, new Date()),
      deps.db
        .select({ slug: tags.slug, name: tags.name })
        .from(contentTags)
        .innerJoin(tags, eq(contentTags.tagId, tags.id))
        .where(eq(contentTags.contentId, content.id)),
      deps.db
        .select({
          mediaId: contentMedia.mediaId,
          position: contentMedia.position,
          exposure: contentMedia.exposure,
          mimeType: mediaAssets.mimeType,
          width: mediaAssets.width,
          height: mediaAssets.height,
          durationSec: mediaAssets.durationSec,
        })
        .from(contentMedia)
        .innerJoin(mediaAssets, eq(contentMedia.mediaId, mediaAssets.id))
        .where(eq(contentMedia.contentId, content.id))
        .orderBy(contentMedia.position),
      collectionNavigation(deps.db, content.id),
    ]);

    let bodyMarkdown: string;
    let access: "full" | "preview";
    let hasPaidContent = false;
    if (fullAccess) {
      bodyMarkdown = content.bodyMarkdown;
      access = "full";
    } else {
      bodyMarkdown = publicPreview(content, deps.env.MEDIA_BLOCK_WEIGHT);
      access = "preview";
      hasPaidContent = content.visibility === "paid";
    }

    // 未授权响应不包含付费正文与付费媒体引用（ADR-0004）
    const visibleMedia = mediaRows.filter((m) => fullAccess || m.exposure === "free");
    if (!fullAccess) bodyMarkdown = stringifyMarkdown(filterStoredMediaRefs(parseMarkdown(bodyMarkdown), new Set(visibleMedia.map(m => m.mediaId))));

    return {
      id: content.id,
      type: content.type,
      slug: content.slug,
      title: content.title,
      description: content.description,
      visibility: content.visibility,
      publishedAt: content.publishedAt?.toISOString() ?? null,
      updatedAt: content.updatedAt.toISOString(),
      revision: content.revision,
      access,
      hasPaidContent,
      bodyMarkdown,
      coverMediaId: content.coverMediaId,
      tags: tagRows,
      collections: collectionRows,
      media: visibleMedia,
    };
}
