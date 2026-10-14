import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { FormatPost } from "./post-format-types";

export class EditorError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function editorDirectory() { return process.env.LOCAL_POST_EDITOR_DIR || null; }
const revisionOf = (source: string) => createHash("sha256").update(source).digest("hex");
async function entries(): Promise<{ slug: string; date: string }[]> {
  const dir = editorDirectory();
  if (!dir) throw new EditorError("未启用本地编辑器", 404);
  const manifest: unknown = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  if (!Array.isArray(manifest) || manifest.length > 1000 || !manifest.every(item => item && typeof item.slug === "string"
    && /^[a-z0-9][a-z0-9-]{0,127}$/.test(item.slug) && typeof item.date === "string")) throw new Error("invalid local manifest");
  return manifest;
}
function split(source: string) {
  const match = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)(?:\r?\n)?/.exec(source);
  if (!match || !/^type:\s*["']?post["']?\s*$/m.test(match[1]!)) throw new Error("invalid post source");
  return { header: source.slice(0, match[0].length), markdown: source.slice(match[0].length) };
}
export async function readFormatPosts(): Promise<FormatPost[]> {
  const items = await entries();
  return Promise.all(items.map(async item => {
    const source = await fs.readFile(path.join(editorDirectory()!, item.slug, "index.md"), "utf8");
    return { ...item, markdown: split(source).markdown, revision: revisionOf(source) };
  }));
}
export async function saveFormatPost(slug: string, markdown: string, revision: string) {
  if (!(await entries()).some(item => item.slug === slug)) throw new EditorError("找不到这篇短帖", 404);
  const filename = path.join(editorDirectory()!, slug, "index.md");
  const lockfile = filename + ".lock";
  const lock = await fs.open(lockfile, "wx", 0o600).catch(error => {
    if (error.code === "EEXIST") throw new EditorError("此短帖正在保存，请稍后重试", 409);
    throw error;
  });
  const temporary = filename + "." + randomUUID() + ".tmp";
  try {
    const source = await fs.readFile(filename, "utf8");
    if (revisionOf(source) !== revision) throw new EditorError("文件已在其他窗口修改。请先复制当前文本，再刷新核对；本次没有覆盖文件。", 409);
    const next = split(source).header + markdown;
    await fs.writeFile(temporary, next, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, filename);
    return { revision: revisionOf(next) };
  } finally {
    await lock.close();
    await fs.unlink(lockfile);
    await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}
