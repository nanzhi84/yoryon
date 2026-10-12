/** 作品引用只有一跳，公开卡片不复制正文、不继承引用者权益。 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { contentReferences, contents, type Database } from "@yoryon/db";
import { associations, contentTargets, enqueueCacheEvent } from "./cache-events";
import { parseMarkdown } from "./markdown";

export function workReferenceSummary(markdown: string) {
  const text: string[] = [];
  visit(parseMarkdown(markdown), (node: any) => {
    if (["leafDirective", "containerDirective", "textDirective", "html", "image"].includes(node.type)) return SKIP;
    if (["text", "inlineCode", "code"].includes(node.type)) text.push(node.value);
  });
  return Array.from(text.join(" ").replace(/\s+/g, " ").trim()).slice(0, 280).join("");
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function collectWorkReferences(tree: Root): string[] {
  const ids = new Set<string>();
  visit(tree, (node: any, _index, parent) => {
    if (!["leafDirective", "containerDirective", "textDirective"].includes(node.type) || node.name !== "work") return;
    const id = node.attributes?.id;
    if (node.type !== "leafDirective" || parent?.type !== "root" || typeof id !== "string" || !UUID.test(id)) {
      throw new Error('作品引用必须是独立的 ::work{id="作品 UUID"}');
    }
    ids.add(id.toLowerCase());
  });
  if (ids.size > 20) throw new Error("每个作品最多引用 20 个不同作品");
  return [...ids];
}

export async function replaceWorkReferences(tx: Tx, contentId: string, ids: string[]) {
  if (ids.includes(contentId)) throw new Error("不能引用作品自身");
  if (ids.length) {
    const targets = await tx.select({ id: contents.id }).from(contents)
      .where(and(inArray(contents.id, ids), eq(contents.status, "published")));
    if (targets.length !== ids.length) throw new Error("引用目标不存在或尚未发布");
  }
  await tx.delete(contentReferences).where(eq(contentReferences.contentId, contentId));
  if (ids.length) await tx.insert(contentReferences).values(ids.map(id => ({ contentId, referencedId: id, targetId: id })));
}

/** 与目标变更同一事务执行；读取卡片仅一跳，直接父级就是完整失效范围。 */
export async function invalidateReferrers(tx: Tx, targetId: string) {
  const parents = await tx.select({ id: contents.id, slug: contents.slug }).from(contentReferences)
    .innerJoin(contents, eq(contentReferences.contentId, contents.id))
    .where(eq(contentReferences.referencedId, targetId)).limit(101);
  if (parents.length > 100) throw new Error("直接引用者超过 100，需分批处理引用关系后重试");
  for (const parent of parents) {
    const changedAt = new Date();
    const revision = randomUUID();
    await tx.update(contents).set({ revision, updatedAt: changedAt,
      previewRevision: sql`case when ${contents.previewRevision} = ${contents.revision} then ${revision}::uuid else ${contents.previewRevision} end`,
    }).where(eq(contents.id, parent.id));
    const related = await associations(tx, parent.id);
    await enqueueCacheEvent(tx, contentTargets(parent.slug, related.tags, related.collections), parent.slug, changedAt.toISOString());
  }
}
