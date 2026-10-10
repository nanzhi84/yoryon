/**
 * Markdown AST 工具：统一解析管线（remark-parse + remark-directive）。
 *
 * 正文中的媒体语法：
 * - 图片：标准 Markdown `![alt](<src>)`
 * - 视频/音频：leaf directive `::video{src="..."}` / `::audio{src="..."}`
 *
 * 存储后的正文中媒体 URL 恒为 `/api/media/<uuid>`；发布前为相对路径（如 ./media/a.png）。
 */
import type { Root, RootContent, Image, Paragraph } from "mdast";
import type { LeafDirective } from "mdast-util-directive";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export const MEDIA_URL_PREFIX = "/api/media/";

export const parser = unified().use(remarkParse).use(remarkDirective);

export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown) as Root;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 从 `/api/media/<uuid>` 形式的 URL 提取媒体 id；非媒体 URL 返回 null。 */
export function mediaIdFromUrl(url: string | undefined | null): string | null {
  if (!url || !url.startsWith(MEDIA_URL_PREFIX)) return null;
  const id = url.slice(MEDIA_URL_PREFIX.length).split(/[?#]/)[0] ?? "";
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

function isMediaDirective(node: RootContent): node is LeafDirective {
  return node.type === "leafDirective" && ((node as LeafDirective).name === "video" || (node as LeafDirective).name === "audio");
}

/** 仅含单张图片（可含空白）的段落视为媒体块。 */
function isImageOnlyParagraph(node: RootContent): node is Paragraph {
  if (node.type !== "paragraph") return false;
  const children = (node as Paragraph).children.filter((c) => !(c.type === "text" && /^\s*$/.test(c.value)));
  return children.length === 1 && children[0]!.type === "image";
}

/** 顶层块是否为媒体块（图片段或 video/audio 指令）。 */
export function isMediaBlock(node: RootContent): boolean {
  return isMediaDirective(node) || isImageOnlyParagraph(node);
}

/** 从块中提取媒体源（URL 或相对路径）。 */
export function mediaSrcOfBlock(node: RootContent): string | null {
  if (isMediaDirective(node)) {
    const src = (node as LeafDirective).attributes?.src;
    return typeof src === "string" ? src : null;
  }
  if (isImageOnlyParagraph(node)) {
    const img = (node as Paragraph).children.find((c) => c.type === "image") as Image;
    return img.url;
  }
  return null;
}

/**
 * 收集 AST（任意子树）中出现的已存储媒体 id（`/api/media/<uuid>`）。
 * 正文渲染/截断后的免费区媒体提取使用。
 */
export function collectStoredMediaIds(tree: Root): string[] {
  const ids = new Set<string>();
  visit(tree, (node: any) => {
    if (node.type === "image") {
      const id = mediaIdFromUrl((node as Image).url);
      if (id) ids.add(id);
    } else if (node.type === "leafDirective" || node.type === "containerDirective" || node.type === "textDirective") {
      const src = (node as LeafDirective).attributes?.src;
      const id = mediaIdFromUrl(typeof src === "string" ? src : null);
      if (id) ids.add(id);
    }
  });
  return [...ids];
}

/**
 * 发布期：收集正文中相对路径引用的媒体（`./media/...`）。
 * 返回去重后的相对路径列表（按出现顺序）。
 */
export function collectRelativeMediaRefs(tree: Root): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const push = (src: string | null | undefined) => {
    if (!src) return;
    if (src.startsWith("/") || /^https?:\/\//i.test(src)) return; // 已发布 URL 或外链
    if (!seen.has(src)) {
      seen.add(src);
      refs.push(src);
    }
  };
  visit(tree, (node: any) => {
    if (node.type === "image") push((node as Image).url);
    else if (node.type === "leafDirective" || node.type === "containerDirective" || node.type === "textDirective") {
      push((node as LeafDirective).attributes?.src);
    }
  });
  return refs;
}

/**
 * 发布期：将正文中的相对媒体引用改写为 `/api/media/<id>`。
 * mapping: 相对路径 → 媒体 id。未命中的相对引用原样保留（发布器应先校验完整性）。
 */
export function rewriteMediaRefs(tree: Root, mapping: ReadonlyMap<string, string>): Root {
  visit(tree, (node: any) => {
    if (node.type === "image") {
      const mapped = mapping.get((node as Image).url);
      if (mapped) (node as Image).url = MEDIA_URL_PREFIX + mapped;
    } else if (node.type === "leafDirective" || node.type === "containerDirective" || node.type === "textDirective") {
      const d = node as LeafDirective;
      const src = d.attributes?.src;
      if (src && mapping.has(src)) {
        d.attributes = { ...d.attributes, src: MEDIA_URL_PREFIX + mapping.get(src) };
      }
    }
  });
  return tree;
}
