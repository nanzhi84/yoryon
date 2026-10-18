/** blog collection * / blog tag list */
import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { enqueueCacheEvent, setCollectionCover } from "@yoryon/core";
import { withCacheTransaction } from "../cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { collectionItems, collections, contents, tags } from "@yoryon/db";
import { closeContext, getContext, withLockClient } from "../context";

/** A daily collection can exceed the cache protocol's 100-target cap. Keep each durable event bounded. */
async function enqueueCollectionEvents(tx: Parameters<typeof enqueueCacheEvent>[0], slug: string, contentSlugs: string[]) {
  const chunks = contentSlugs.length ? Array.from({ length: Math.ceil(contentSlugs.length / 90) }, (_, index) => contentSlugs.slice(index * 90, (index + 1) * 90)) : [[]];
  for (const chunk of chunks) await enqueueCacheEvent(tx, {
    tags: ["collections", "member-feed", "sitemap", `collection:${slug}`, ...chunk.map(content => `content:${content}`)],
    paths: ["/c", `/c/${slug}`, "/sitemap.xml", ...chunk.map(content => `/p/${content}`)],
  });
}

export function registerCollectionCommands(program: Command) {
  const collection = program.command("collection").description("合集管理");

  collection
    .command("create")
    .argument("<slug>")
    .requiredOption("--title <title>", "合集标题")
    .option("--description <desc>", "描述（更新时省略则保留）")
    .option("--visibility <public|paid>", "可见性（新建默认 public，更新时省略则保留）")
    .action(async (slug: string, opts: { title: string; description?: string; visibility?: string }) => {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error("slug 必须为 kebab-case");
      if (opts.visibility !== undefined && !["public", "paid"].includes(opts.visibility)) throw new Error("visibility 必须为 public 或 paid");
      if (!opts.title.trim() || opts.title.length > 200) throw new Error("合集标题长度须为 1–200");
      const ctx = getContext();
      try {
        await withCacheTransaction(async tx => {
          const [previous] = await tx.select({ title: collections.title, description: collections.description, visibility: collections.visibility }).from(collections)
            .where(eq(collections.slug, slug)).for("update");
          const description = opts.description ?? previous?.description ?? "";
          const visibility = (opts.visibility ?? previous?.visibility ?? "public") as "public" | "paid";
          if (previous && previous.title === opts.title && previous.description === description && previous.visibility === visibility) return;
          await tx
            .insert(collections)
            .values({ slug, title: opts.title, description, visibility })
            .onConflictDoUpdate({ target: collections.slug, set: { title: opts.title, description, visibility, updatedAt: new Date() } });
          const related = await tx.select({ slug: contents.slug }).from(collectionItems).innerJoin(collections, eq(collectionItems.collectionId, collections.id)).innerJoin(contents, eq(collectionItems.contentId, contents.id)).where(eq(collections.slug, slug));
          // 元信息只失效嵌入的合集信息；只有阅读权限变化才撤销成员正文版本。
          if (previous && previous.visibility !== visibility) for (const row of related) {
            const revision = randomUUID();
            await tx.update(contents).set({ revision, updatedAt: new Date(),
              previewRevision: sql`case when ${contents.previewRevision} = ${contents.revision} then ${revision}::uuid else ${contents.previewRevision} end`,
            }).where(eq(contents.slug, row.slug));
          }
          await enqueueCollectionEvents(tx, slug, related.map(row => row.slug));
        });
        console.log(`✓ collection ${slug} upserted`);
      } finally {
        await closeContext();
      }
    });

  collection
    .command("list")
    .description("列出合集")
    .action(async () => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.select().from(collections).orderBy(desc(collections.isPinned), desc(collections.updatedAt), asc(collections.id));
        for (const r of rows) console.log(`${r.visibility}\t${r.isPinned ? "pinned" : "-"}\t${r.updatedAt.toISOString()}\t${r.slug}\t${r.title}`);
      } finally {
        await closeContext();
      }
    });

  for (const [command, pinned] of [["pin", true], ["unpin", false]] as const) {
    collection.command(command).argument("<slug>").description(pinned ? "置顶合集（可同时置顶多个）" : "取消合集置顶")
      .action(async (slug: string) => {
        try {
          await withCacheTransaction(async tx => {
            const [row] = await tx.select({ id: collections.id, pinned: collections.isPinned }).from(collections).where(eq(collections.slug, slug)).limit(1);
            if (!row) throw new Error(`合集不存在: ${slug}`);
            if (row.pinned === pinned) return;
            await tx.update(collections).set({ isPinned: pinned, updatedAt: new Date() }).where(eq(collections.id, row.id));
            await enqueueCacheEvent(tx, { tags: ["collections", "member-feed", `collection:${slug}`], paths: ["/c", `/c/${slug}`] });
          });
          console.log(`✓ collection ${slug} ${pinned ? "pinned" : "unpinned"}`);
        } finally { await closeContext(); }
      });
  }

  async function changeCover(slug: string, filename: string | null) {
    const ctx = getContext();
    try {
      const result = await withLockClient(lockClient => setCollectionCover({ lockClient, storage: ctx.storage, logger: console.log }, slug, filename));
      console.log(`✓ collection ${slug} cover ${result.mediaId ?? "cleared"}`);
    } finally { await closeContext(); }
  }
  collection.command("cover").argument("<slug>").argument("<file>").description("上传图片并设为公开合集封面（复用媒体去重与 GC）").action(changeCover);
  collection.command("clear-cover").argument("<slug>").description("清除封面关联（旧对象留待 GC）").action((slug: string) => changeCover(slug, null));

  // 成员增删只通过文章 frontmatter.collections + publish；CLI 仅管理合集元数据和排序。

  collection
    .command("sort")
    .argument("<collection-slug>")
    .argument("<content-slugs...>", "按给定顺序重排（未列出的成员排到末尾）")
    .description("重排合集成员顺序")
    .action(async (collectionSlug: string, contentSlugs: string[]) => {
      const ctx = getContext();
      try {
        const coll = await ctx.db.select().from(collections).where(eq(collections.slug, collectionSlug)).limit(1);
        if (!coll[0]) throw new Error(`合集不存在: ${collectionSlug}`);
        await withCacheTransaction(async (tx) => {
          if (new Set(contentSlugs).size !== contentSlugs.length) throw new Error("章节排序不能包含重复作品");
          await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, coll[0]!.id)).for("update");
          const items = await tx.select().from(collectionItems).where(eq(collectionItems.collectionId, coll[0]!.id))
            .orderBy(asc(collectionItems.sortOrder), asc(collectionItems.contentId));
          const byContent = new Map(items.map((i) => [i.contentId, i]));
          let order = 1;
          for (const slug of contentSlugs) {
            const cont = await tx.select({ id: contents.id, type: contents.type }).from(contents).where(eq(contents.slug, slug)).limit(1);
            if (!cont[0]) throw new Error(`内容不存在: ${slug}`);
            if (cont[0].type !== "article") throw new Error(`合集仅支持文章: ${slug}`);
            const item = byContent.get(cont[0]!.id);
            if (!item) throw new Error(`内容不在合集中: ${slug}`);
            await tx
              .update(collectionItems)
              .set({ sortOrder: order++ })
              .where(and(eq(collectionItems.collectionId, coll[0]!.id), eq(collectionItems.contentId, cont[0]!.id)));
            byContent.delete(cont[0]!.id);
          }
          for (const rest of byContent.values()) {
            await tx
              .update(collectionItems)
              .set({ sortOrder: order++ })
              .where(and(eq(collectionItems.collectionId, coll[0]!.id), eq(collectionItems.contentId, rest.contentId)));
          }
          await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, coll[0]!.id));
          const related = await tx.select({ slug: contents.slug }).from(collectionItems).innerJoin(contents, eq(contents.id, collectionItems.contentId))
            .where(eq(collectionItems.collectionId, coll[0]!.id));
          await enqueueCollectionEvents(tx, collectionSlug, related.map(row => row.slug));
        });
        console.log(`✓ ${collectionSlug} sorted`);
      } finally {
        await closeContext();
      }
    });

  const tag = program.command("tag").description("标签管理");
  tag
    .command("list")
    .description("列出标签")
    .action(async () => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.select().from(tags).orderBy(asc(tags.slug));
        for (const r of rows) console.log(`${r.slug}\t${r.name}`);
      } finally {
        await closeContext();
      }
    });
}
