/** blog collection * / blog tag list */
import type { Command } from "commander";
import { and, asc, eq } from "drizzle-orm";
import { collectionItems, collections, contents, tags } from "@yoryon/db";
import { closeContext, getContext } from "../context";

export function registerCollectionCommands(program: Command) {
  const collection = program.command("collection").description("合集管理");

  collection
    .command("create")
    .argument("<slug>")
    .requiredOption("--title <title>", "合集标题")
    .option("--description <desc>", "描述", "")
    .option("--visibility <public|paid>", "可见性", "public")
    .action(async (slug: string, opts: { title: string; description: string; visibility: string }) => {
      const ctx = getContext();
      try {
        await ctx.db
          .insert(collections)
          .values({ slug, title: opts.title, description: opts.description, visibility: opts.visibility as "public" | "paid" })
          .onConflictDoUpdate({ target: collections.slug, set: { title: opts.title, description: opts.description, visibility: opts.visibility as "public" | "paid", updatedAt: new Date() } });
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
        const rows = await ctx.db.select().from(collections).orderBy(asc(collections.slug));
        for (const r of rows) console.log(`${r.visibility}\t${r.slug}\t${r.title}`);
      } finally {
        await closeContext();
      }
    });

  collection
    .command("add")
    .argument("<collection-slug>")
    .argument("<content-slug>")
    .description("把内容加入合集（追加到末尾）")
    .action(async (collectionSlug: string, contentSlug: string) => {
      const ctx = getContext();
      try {
        const coll = await ctx.db.select().from(collections).where(eq(collections.slug, collectionSlug)).limit(1);
        if (!coll[0]) throw new Error(`合集不存在: ${collectionSlug}`);
        const cont = await ctx.db.select().from(contents).where(eq(contents.slug, contentSlug)).limit(1);
        if (!cont[0]) throw new Error(`内容不存在: ${contentSlug}`);
        await ctx.db.transaction(async (tx) => {
          const max = await tx.select({ max: collectionItems.sortOrder }).from(collectionItems).where(eq(collectionItems.collectionId, coll[0]!.id));
          const next = Math.max(0, ...max.map((m) => m.max)) + 1;
          await tx.insert(collectionItems).values({ collectionId: coll[0]!.id, contentId: cont[0]!.id, sortOrder: next }).onConflictDoNothing();
          await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, coll[0]!.id));
        });
        console.log(`✓ ${contentSlug} → ${collectionSlug}`);
      } finally {
        await closeContext();
      }
    });

  collection
    .command("remove")
    .argument("<collection-slug>")
    .argument("<content-slug>")
    .description("把内容移出合集")
    .action(async (collectionSlug: string, contentSlug: string) => {
      const ctx = getContext();
      try {
        const coll = await ctx.db.select().from(collections).where(eq(collections.slug, collectionSlug)).limit(1);
        if (!coll[0]) throw new Error(`合集不存在: ${collectionSlug}`);
        const cont = await ctx.db.select().from(contents).where(eq(contents.slug, contentSlug)).limit(1);
        if (!cont[0]) throw new Error(`内容不存在: ${contentSlug}`);
        await ctx.db
          .delete(collectionItems)
          .where(and(eq(collectionItems.collectionId, coll[0]!.id), eq(collectionItems.contentId, cont[0]!.id)));
        console.log(`✓ ${contentSlug} removed from ${collectionSlug}`);
      } finally {
        await closeContext();
      }
    });

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
        await ctx.db.transaction(async (tx) => {
          const items = await tx.select().from(collectionItems).where(eq(collectionItems.collectionId, coll[0]!.id));
          const byContent = new Map(items.map((i) => [i.contentId, i]));
          let order = 1;
          for (const slug of contentSlugs) {
            const cont = await tx.select({ id: contents.id }).from(contents).where(eq(contents.slug, slug)).limit(1);
            if (!cont[0]) throw new Error(`内容不存在: ${slug}`);
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
