/** blog publish / unpublish / content list|delete */
import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { desc, eq } from "drizzle-orm";
import { contents } from "@yoryon/db";
import { publishPost } from "@yoryon/core";
import { closeContext, getContext, withLockClient } from "../context";

async function resolvePostDirs(target: string): Promise<string[]> {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [path.dirname(path.resolve(target))];
  const abs = path.resolve(target);
  const hasIndex = await fs.stat(path.join(abs, "index.md")).then(() => true, () => false);
  if (hasIndex) return [abs];
  // 目录下每个含 index.md 的子目录都是一篇内容
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const dirs: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sub = path.join(abs, e.name);
    if (await fs.stat(path.join(sub, "index.md")).then(() => true, () => false)) dirs.push(sub);
  }
  if (dirs.length === 0) throw new Error(`${target}: 未找到 index.md（也不是包含多篇内容的目录）`);
  return dirs;
}

export function registerContentCommands(program: Command) {
  program
    .command("publish")
    .argument("<dir|file>", "发布目录（含 index.md 与 media/）或 index.md 路径；也可以是多篇内容的父目录")
    .description("两阶段发布：上传媒体 → 单事务提交；按 slug upsert，可安全重试（ADR-0006）")
    .action(async (target: string) => {
      const ctx = getContext();
      const dirs = await resolvePostDirs(target);
      try {
        await withLockClient(async (lockClient) => {
          for (const dir of dirs) {
            const result = await publishPost(
              { lockClient, storage: ctx.storage, mediaBlockWeight: ctx.env.MEDIA_BLOCK_WEIGHT, logger: (m) => console.log(`  ${m}`) },
              dir,
            );
            console.log(`✓ ${result.slug} published (${result.uploaded.length} uploaded, ${result.skippedExisting.length} reused)`);
          }
        });
      } finally {
        await closeContext();
      }
    });

  program
    .command("unpublish")
    .argument("<slug>")
    .description("取消发布（status → draft；不动 OSS 对象）")
    .action(async (slug: string) => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.update(contents).set({ status: "draft", updatedAt: new Date() }).where(eq(contents.slug, slug)).returning({ id: contents.id });
        if (rows.length === 0) throw new Error(`内容不存在: ${slug}`);
        console.log(`✓ ${slug} → draft`);
      } finally {
        await closeContext();
      }
    });

  const content = program.command("content").description("内容管理");

  content
    .command("list")
    .description("列出内容")
    .option("--all", "包含草稿", false)
    .action(async (opts: { all: boolean }) => {
      const ctx = getContext();
      try {
        const rows = await ctx.db
          .select({
            slug: contents.slug,
            type: contents.type,
            status: contents.status,
            visibility: contents.visibility,
            title: contents.title,
            publishedAt: contents.publishedAt,
          })
          .from(contents)
          .orderBy(desc(contents.createdAt));
        for (const r of rows) {
          if (!opts.all && r.status !== "published") continue;
          console.log(`${r.status}\t${r.visibility}\t${r.type}\t${r.slug}\t${r.title}`);
        }
      } finally {
        await closeContext();
      }
    });

  content
    .command("delete")
    .argument("<slug>")
    .description("删除内容（级联删除关联边；OSS 对象留待 GC）")
    .action(async (slug: string) => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.delete(contents).where(eq(contents.slug, slug)).returning({ id: contents.id });
        if (rows.length === 0) throw new Error(`内容不存在: ${slug}`);
        console.log(`✓ ${slug} deleted`);
      } finally {
        await closeContext();
      }
    });
}
