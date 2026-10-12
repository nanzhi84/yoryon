/** blog publish / unpublish / content list|delete */
import fs from "node:fs/promises";
import { mutateContent } from "../cache";
import path from "node:path";
import type { Command } from "commander";
import { desc, eq } from "drizzle-orm";
import { contents } from "@yoryon/db";
import { associations, contentTargets, enqueueCacheEvent, publishPost } from "@yoryon/core";
import { withCacheTransaction } from "../cache";
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
            console.log(`✓ ${result.slug} database committed (${result.uploaded.length} uploaded, ${result.skippedExisting.length} reused); page state is reported by cache event above`);
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
        await mutateContent(slug, false);
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
            isPinned: contents.isPinned,
            title: contents.title,
            publishedAt: contents.publishedAt,
          })
          .from(contents)
          .orderBy(desc(contents.createdAt));
        for (const r of rows) {
          if (!opts.all && r.status !== "published") continue;
          console.log(`${r.status}\t${r.visibility}\t${r.type}\t${r.isPinned ? "pinned" : "-"}\t${r.slug}\t${r.title}`);
        }
      } finally {
        await closeContext();
      }
    });

  /** pin/unpin 共用：事务内更新置顶标记与列表版本事件。
   * 门禁实时读已提交的版本；投递失败不影响旧游标 409，retry 负责清理和预热缓存。 */
  async function setPinned(slug: string, pinned: boolean) {
    await withCacheTransaction(async (tx) => {
      const rows = await tx
        .select({ id: contents.id, type: contents.type, status: contents.status, isPinned: contents.isPinned })
        .from(contents)
        .where(eq(contents.slug, slug));
      const row = rows[0];
      if (!row) throw new Error(`内容不存在: ${slug}`);
      if (pinned) {
        if (row.type !== "article") throw new Error(`仅支持置顶 article，当前类型: ${row.type}`);
        if (row.status !== "published") throw new Error(`仅支持置顶已发布内容，当前状态: ${row.status}`);
      }
      if (row.isPinned === pinned) {
        console.log(`- ${slug} 已是${pinned ? "置顶" : "非置顶"}状态，无需变更`);
        return;
      }
      await tx.update(contents).set({ isPinned: pinned }).where(eq(contents.id, row.id));
      // 不动 revision/updated_at/published_at：正文与发布时间未变，重新发布也不清除置顶。
      const related = await associations(tx, row.id);
      await enqueueCacheEvent(tx, contentTargets(slug, related.tags, related.collections), slug);
    });
  }

  content
    .command("pin")
    .argument("<slug>")
    .description("置顶已发布文章（仅 article；首页 feed 优先显示）")
    .action(async (slug: string) => {
      try {
        await setPinned(slug, true);
        console.log(`✓ ${slug} pinned`);
      } finally {
        await closeContext();
      }
    });

  content
    .command("unpin")
    .argument("<slug>")
    .description("取消置顶（幂等）")
    .action(async (slug: string) => {
      try {
        await setPinned(slug, false);
        console.log(`✓ ${slug} unpinned`);
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
        await mutateContent(slug, true);
        console.log(`✓ ${slug} deleted`);
      } finally {
        await closeContext();
      }
    });
}
