/**
 * 分阶段发布（ADR-0006）——packages/core 唯一实现，CLI 调用。
 *
 * 阶段 A（准备）：解析 frontmatter/正文 → 计算媒体清单与 sha256 → 上传（HEAD 跳过、有限重试）。
 * 阶段 B（提交）：单个 DB 事务完成 media_assets upsert、内容 upsert（按 slug）、
 *   content_media 替换（含 exposure 重算）、content_tags 替换、合集成员变更。
 *
 * 事务提交 = 发布成功的唯一判定；全程持有 advisory lock（与 GC 互斥）。
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  collectionItems,
  collections,
  contentMedia,
  contents,
  contentTags,
  tags,
  type Database,
} from "@yoryon/db";
import { PUBLISH_GC_LOCK_NAME } from "@yoryon/config";
import { collectRelativeMediaRefs, collectStoredMediaIds, parseMarkdown, rewriteMediaRefs } from "./markdown";
import { hasPreviewMarker, stringifyMarkdown, truncateForPreview } from "./preview";
import type { MediaStorage } from "./storage";
import { prepareLocalMedia, uploadPreparedMedia, upsertPreparedMedia, type PreparedMedia } from "./media-upload";
import { acquirePublishGcLock, type LockClient } from "./locks";
import type pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@yoryon/db/schema";
import { associations, contentTargets, deliverCacheEvents, enqueueCacheEvent } from "./cache-events";
import { collectWorkReferences, invalidateReferrers, replaceWorkReferences } from "./references";

import { syncSearchProjection } from "./search-projection";

const frontmatterSchema = z.object({
  title: z.string().trim().max(200).default(""),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be kebab-case"),
  type: z.enum(["article", "post"]).default("article"),
  description: z.string().default(""),
  visibility: z.enum(["public", "paid"]).default("public"),
  preview: z
    .object({
      mode: z.enum(["full", "percent", "marker", "none"]).optional(),
      percent: z.number().int().min(1).max(99).optional(),
    })
    .default({}),
  tags: z.array(z.string()).default([]),
  collections: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).default([]),
  show_in_home: z.boolean().optional(),
  published_at: z.coerce.date().optional(),
  cover: z.string().optional(),
}).transform((fm) => ({
  ...fm,
  preview: { ...fm.preview, mode: fm.preview.mode ?? (fm.visibility === "paid" ? "none" as const : "full" as const) },
}));

export type PostFrontmatter = z.infer<typeof frontmatterSchema>;

export interface ParsedPost {
  frontmatter: PostFrontmatter;
  bodyMarkdown: string;
  dir: string;
}

/** 解析发布目录（index.md + 相对媒体引用）。 */
export async function parsePostDir(dir: string): Promise<ParsedPost> {
  const indexPath = path.join(dir, "index.md");
  const raw = await fs.readFile(indexPath, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${indexPath}: missing frontmatter (--- ... ---)`);
  const data = yaml.load(m[1]!);
  if (data && typeof data === "object" && "media" in data) {
    throw new Error(`${indexPath}: 请将 frontmatter media 移到正文图片、::video 或 ::audio；不会静默忽略主媒体`);
  }
  const fm = frontmatterSchema.parse(data ?? {});
  if (fm.type === "post" && fm.collections.length) throw new Error(`${indexPath}: 合集仅支持文章，请移除帖子的 collections 或将 type 改为 article`);
  if (fm.type === "article" && !fm.title) throw new Error(`${indexPath}: article 需要标题`);
  if (!m[2]!.trim()) throw new Error(`${indexPath}: 正文不能为空`);
  collectWorkReferences(parseMarkdown(m[2]!));
  if (fm.preview.mode === "percent" && fm.preview.percent === undefined) {
    throw new Error(`${indexPath}: preview.mode=percent 需要 percent（1-99）`);
  }
  if (fm.preview.mode === "marker" && !hasPreviewMarker(m[2]!)) {
    throw new Error(`${indexPath}: preview.mode=marker 需要独立的 <!-- more --> 标记`);
  }
  return { frontmatter: fm, bodyMarkdown: m[2]!, dir };
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

export function mimeForFile(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export interface PublishDeps {
  /** 专用锁连接（会话级 advisory lock 生命周期绑定此连接） */
  lockClient: pg.Client;
  storage: MediaStorage;
  mediaBlockWeight?: number;
  logger?: (msg: string) => void;
}

export interface PublishResult {
  slug: string;
  contentId: string;
  uploaded: string[];
  skippedExisting: string[];
  mediaCount: number;
}

/**
 * 发布目录（按 slug upsert，幂等可重试）。
 */
export async function publishPost(deps: PublishDeps, dir: string): Promise<PublishResult> {
  const log = deps.logger ?? (() => {});
  const lock = await acquirePublishGcLock(deps.lockClient, { blocking: true, name: PUBLISH_GC_LOCK_NAME });
  try {
    const post = await parsePostDir(dir);
    const fm = post.frontmatter;

    // ---- 阶段 A：媒体清单与上传 ----
    const bodyTree = parseMarkdown(post.bodyMarkdown);
    const bodyRefs = collectRelativeMediaRefs(bodyTree);
    const extraRefs = [fm.cover].filter((x): x is string => typeof x === "string" && x.length > 0);
    const allRefs = [...new Set([...bodyRefs, ...extraRefs])];

    const files = new Map<string, Omit<PreparedMedia, "data">>();
    const uploaded: string[] = [];
    const skippedExisting: string[] = [];
    for (const ref of allRefs) {
      const absPath = path.resolve(post.dir, ref);
      if (!absPath.startsWith(path.resolve(post.dir) + path.sep)) throw new Error(`媒体引用越出发布目录: ${ref}`);
      const file = await prepareLocalMedia(absPath, mimeForFile(absPath));
      const state = await uploadPreparedMedia(deps.storage, file);
      (state === "uploaded" ? uploaded : skippedExisting).push(file.ossKey);
      log(`${state === "uploaded" ? "uploaded" : "skip (exists)"}: ${ref} → ${file.ossKey}`);
      const { data: _data, ...metadata } = file;
      files.set(ref, metadata);
    }

    // ---- 阶段 B：单事务提交（与锁同一连接） ----
    const txDb = drizzle(deps.lockClient, { schema }) as unknown as Database;
    const result = await txDb.transaction(async (tx) => {
      const prior = await tx.select({ id: contents.id, showInHome: contents.showInHome }).from(contents).where(eq(contents.slug, fm.slug)).limit(1);
      const old = prior[0] ? await associations(tx, prior[0].id) : { tags: [], collections: [], listings: [] };
      const revision = new Date();
      const version = randomUUID();
      // media_assets upsert（ON CONFLICT oss_key DO NOTHING 后取 id）
      const mediaIdByRef = new Map<string, string>();
      for (const [ref, file] of files) mediaIdByRef.set(ref, await upsertPreparedMedia(tx, file));

      // 改写正文媒体引用 → /api/media/<id>
      const mapping = new Map<string, string>();
      for (const [ref, id] of mediaIdByRef) mapping.set(ref, id);
      // Plain-text posts carry author-controlled blank lines. AST serialization
      // normalizes those away; only remove the conventional frontmatter separator.
      const rewritten = fm.type === "post" && mapping.size === 0
        ? post.bodyMarkdown.replace(/^\r?\n/, "")
        : stringifyMarkdown(rewriteMediaRefs(parseMarkdown(post.bodyMarkdown), mapping));
      const preview = truncateForPreview(rewritten, fm.preview.mode, fm.preview.mode === "percent" ? fm.preview.percent! : null, {
        ...(deps.mediaBlockWeight !== undefined ? { mediaBlockWeight: deps.mediaBlockWeight } : {}),
      });

      // 内容 upsert（按 slug）
      const publishedAt = fm.published_at ?? new Date();
      const showInHome = fm.show_in_home ?? prior[0]?.showInHome ?? fm.collections.length === 0;
      const coverId = fm.cover ? mediaIdByRef.get(fm.cover)! : null;
      const existingRows = await tx.select({ isPinned: contents.isPinned }).from(contents).where(eq(contents.slug, fm.slug)).limit(1);
      if (existingRows[0]?.isPinned && fm.visibility !== "public") {
        throw new Error(`${fm.slug} 处于首页置顶状态；改为付费前请先取消置顶`);
      }
      const inserted = await tx
        .insert(contents)
        .values({
          type: fm.type,
          slug: fm.slug,
          title: fm.title,
          description: fm.description,
          bodyMarkdown: rewritten,
          publicPreviewMarkdown: fm.visibility === "public" ? rewritten : preview.freeMarkdown,
          previewRevision: version,
          status: "published",
          visibility: fm.visibility,
          previewMode: fm.preview.mode,
          previewPercent: fm.preview.mode === "percent" ? fm.preview.percent! : null,
          coverMediaId: coverId,
          showInHome,
          publishedAt,
          updatedAt: revision,
          revision: version,
        })
        .onConflictDoUpdate({
          target: contents.slug,
          set: {
            type: fm.type,
            title: fm.title,
            description: fm.description,
            bodyMarkdown: rewritten,
            publicPreviewMarkdown: fm.visibility === "public" ? rewritten : preview.freeMarkdown,
            previewRevision: version,
            status: "published",
            visibility: fm.visibility,
            previewMode: fm.preview.mode,
            previewPercent: fm.preview.mode === "percent" ? fm.preview.percent! : null,
            coverMediaId: coverId,
            showInHome,
            publishedAt,
            updatedAt: revision,
            revision: version,
          },
        })
        .returning({ id: contents.id });
      const contentId = inserted[0]!.id;
      await syncSearchProjection(tx, { id: contentId, revision: version, title: fm.title, description: fm.description, bodyMarkdown: rewritten });
      await replaceWorkReferences(tx, contentId, collectWorkReferences(parseMarkdown(rewritten)));

      // content_media 替换（含 exposure 重算）
      await tx.delete(contentMedia).where(eq(contentMedia.contentId, contentId));
      const freeSet = new Set(preview.freeMediaIds);
      const bodyIds = collectStoredMediaIds(parseMarkdown(rewritten));
      const rows: { contentId: string; mediaId: string; position: number; exposure: "free" | "paid" }[] = [];
      let position = 0;
      for (const mid of bodyIds) {
        if (rows.some((r) => r.mediaId === mid)) continue; // 同一媒体多引用合并为一条边
        rows.push({ contentId, mediaId: mid, position: position++, exposure: fm.visibility === "public" || freeSet.has(mid) ? "free" : "paid" });
      }
      if (rows.length > 0) await tx.insert(contentMedia).values(rows);

      // content_tags 替换（标签按 slug upsert，name 缺省 = slug）
      await tx.delete(contentTags).where(eq(contentTags.contentId, contentId));
      for (const slug of fm.tags) {
        await tx.insert(tags).values({ slug, name: slug }).onConflictDoNothing({ target: tags.slug });
        const t = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1);
        await tx.insert(contentTags).values({ contentId, tagId: t[0]!.id }).onConflictDoNothing();
      }

      // 合集成员变更：frontmatter 为该内容合集成员的唯一事实源
      const wantedCollIds: string[] = [];
      for (const collSlug of fm.collections) {
        const coll = await tx.select({ id: collections.id }).from(collections).where(eq(collections.slug, collSlug)).limit(1);
        if (coll.length === 0) throw new Error(`合集不存在: ${collSlug}（先用 blog collection create 创建）`);
        wantedCollIds.push(coll[0]!.id);
      }
      // Collection row locks serialize append/reorder even when another writer uses a different content slug.
      const affectedSlugs = [...new Set([...old.collections, ...fm.collections])];
      if (affectedSlugs.length) await tx.select({ id: collections.id }).from(collections)
        .where(inArray(collections.slug, affectedSlugs)).orderBy(collections.id).for("update");
      await tx
        .delete(collectionItems)
        .where(
          wantedCollIds.length > 0
            ? and(eq(collectionItems.contentId, contentId), notInArray(collectionItems.collectionId, wantedCollIds))
            : eq(collectionItems.contentId, contentId),
        );
      for (const collId of wantedCollIds) {
        await tx
          .insert(collectionItems)
          .values({
            collectionId: collId,
            contentId,
            sortOrder: sql`(select coalesce(max(sort_order), 0) + 1 from ${collectionItems} where ${collectionItems.collectionId} = ${collId})`,
          })
          .onConflictDoNothing();
      }

      if (affectedSlugs.length) await tx.update(collections).set({ updatedAt: revision }).where(inArray(collections.slug, affectedSlugs));
      await enqueueCacheEvent(tx, contentTargets(fm.slug, [...old.tags, ...fm.tags], [...old.collections, ...fm.collections], [...old.listings, { type: fm.type, visibility: fm.visibility, status: "published", showInHome }]), fm.slug, revision.toISOString());
      await invalidateReferrers(tx, contentId);
      return { contentId };
    });

    log(`published: ${fm.slug} (content ${result.contentId})`);
    await deliverCacheEvents(txDb, { logger: log });
    return { slug: fm.slug, contentId: result.contentId, uploaded, skippedExisting, mediaCount: files.size };
  } finally {
    await lock.release();
  }
}
