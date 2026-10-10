/** 发布目录 fixture：生成 index.md + 复制媒体资产。 */
import fs from "node:fs/promises";
import path from "node:path";
import { E2E } from "./env";

export interface PostSpec {
  slug: string;
  title?: string;
  type?: "article" | "image" | "video" | "audio";
  visibility?: "public" | "paid";
  previewMode?: "full" | "percent" | "marker" | "none";
  previewPercent?: number;
  description?: string;
  tags?: string[];
  collections?: string[];
  publishedAt?: string;
  cover?: string; // 相对路径，如 ./media/tiny.png
  primaryMedia?: string; // 相对路径，type != article 时必填
  /** 正文 Markdown（媒体以相对路径引用，如 ./media/tiny.png） */
  body: string;
  /** 额外媒体文件（按名写入 media/，用于用例唯一媒体） */
  extraFiles?: Record<string, Buffer | string>;
}

export async function createPost(spec: PostSpec): Promise<string> {
  const dir = path.join(E2E.postsRoot, spec.slug);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, "media"), { recursive: true });

  // 复制引用到的媒体资产
  const refs = new Set<string>();
  for (const m of spec.body.matchAll(/\.\/media\/([\w.-]+)/g)) refs.add(m[1]!);
  if (spec.cover) refs.add(spec.cover.replace("./media/", ""));
  if (spec.primaryMedia) refs.add(spec.primaryMedia.replace("./media/", ""));
  for (const name of refs) {
    const extra = spec.extraFiles?.[name];
    if (extra !== undefined) {
      await fs.writeFile(path.join(dir, "media", name), extra);
    } else {
      await fs.copyFile(path.join(E2E.assetsRoot, name), path.join(dir, "media", name));
    }
  }

  const fm: Record<string, unknown> = {
    title: spec.title ?? spec.slug,
    slug: spec.slug,
    type: spec.type ?? "article",
    visibility: spec.visibility ?? "public",
    preview: { mode: spec.previewMode ?? "full", ...(spec.previewPercent !== undefined ? { percent: spec.previewPercent } : {}) },
  };
  if (spec.description) fm.description = spec.description;
  if (spec.tags?.length) fm.tags = spec.tags;
  if (spec.collections?.length) fm.collections = spec.collections;
  if (spec.publishedAt) fm.published_at = spec.publishedAt;
  if (spec.cover) fm.cover = spec.cover;
  if (spec.primaryMedia) fm.media = spec.primaryMedia;

  const yaml = Object.entries(fm)
    .map(([k, v]) => {
      if (typeof v === "object" && !Array.isArray(v)) {
        const inner = Object.entries(v as Record<string, unknown>).map(([ik, iv]) => `${ik}: ${iv}`).join(", ");
        return `${k}: { ${inner} }`;
      }
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join("\n");

  await fs.writeFile(path.join(dir, "index.md"), `---\n${yaml}\n---\n\n${spec.body}\n`);
  return dir;
}

export const TINY_TEXT = (n: number) => `段落内容 ${n}。`.repeat(30); // 每段约 200 字符
