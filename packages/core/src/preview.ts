/**
 * 预览截断（架构 §6.2，ADR-0004）——packages/core 唯一实现。
 *
 * 输入 body_markdown + preview_mode + preview_percent，输出免费区 AST/Markdown、
 * 免费媒体 id 集合。同一函数服务两条路径：
 *   - 阅读路径：未授权响应只含免费区正文；
 *   - 发布路径：计算 content_media.exposure。
 *
 * 截断在 AST 层进行，绝不直接切割 Markdown 源码；媒体块为原子单位。
 */
import type { Root, RootContent, PhrasingContent } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";
import { directiveToMarkdown } from "mdast-util-directive";
import { collectStoredMediaIds, isMediaBlock, parseMarkdown } from "./markdown";
import { DEFAULT_MEDIA_BLOCK_WEIGHT } from "@yoryon/config";

export type PreviewMode = "full" | "percent" | "marker" | "none";

export interface PreviewResult {
  /** 免费区 Markdown（已归一化序列化） */
  freeMarkdown: string;
  /** 免费区引用的已存储媒体 id（exposure='free' 的依据） */
  freeMediaIds: string[];
  /** 是否存在付费区（false 时无需付费墙提示） */
  hasPaidContent: boolean;
  /** 全文引用的已存储媒体 id */
  allMediaIds: string[];
}

const MARKER_RE = /^<!--\s*more\s*-->$/i;

export function hasPreviewMarker(markdown: string): boolean {
  return parseMarkdown(markdown).children.some((b) => b.type === "html" && MARKER_RE.test(b.value.trim()));
}

/** 文本块按字符数计权：取块在源文中的原始片段长度。 */
function blockWeight(node: RootContent, source: string, mediaBlockWeight: number): number {
  if (isMediaBlock(node)) return mediaBlockWeight;
  const pos = node.position;
  if (pos && pos.start.offset !== undefined && pos.end.offset !== undefined) {
    return Math.max(1, pos.end.offset - pos.start.offset);
  }
  // 无位置信息时退化为固定权重（remark-parse 总是带 position）
  return 32;
}

/** 只细分纯文本/强调/链接段落；含媒体、HTML 或其它原子节点的段落保守保留到付费区。 */
function textPrefix<T extends RootContent & { children: PhrasingContent[] }>(node: T, budget: number): T | null {
  const supported = (n: PhrasingContent): boolean =>
    n.type === "text" || ((n.type === "strong" || n.type === "emphasis" || n.type === "link") && n.children.every(supported));
  if (budget <= 0 || !node.children.every(supported)) return null;
  const take = (children: PhrasingContent[]): PhrasingContent[] => {
    const out: PhrasingContent[] = [];
    for (const child of children) {
      if (budget <= 0) break;
      if (child.type === "text") {
        const chars = Array.from(child.value);
        const value = chars.slice(0, budget).join("");
        budget -= Math.min(budget, chars.length);
        if (value) out.push({ ...child, value });
      } else if (child.type === "strong" || child.type === "emphasis" || child.type === "link") {
        const nested = take(child.children);
        if (nested.length) out.push({ ...child, children: nested });
      }
    }
    return out;
  };
  const children = take(node.children);
  return children.length ? { ...node, children } : null;
}

export interface TruncateOptions {
  mediaBlockWeight?: number;
}

/** 核心截断函数。markdown 为已存储正文（媒体 URL 为 /api/media/<id> 形式）。 */
export function truncateForPreview(
  markdown: string,
  mode: PreviewMode,
  percent: number | null,
  options: TruncateOptions = {},
): PreviewResult {
  const tree = parseMarkdown(markdown);
  const blocks = tree.children;
  const mediaWeight = options.mediaBlockWeight ?? DEFAULT_MEDIA_BLOCK_WEIGHT;

  let freeBlocks: RootContent[];
  let paidBlocks: RootContent[];

  switch (mode) {
    case "full":
      freeBlocks = blocks;
      paidBlocks = [];
      break;
    case "none":
      freeBlocks = [];
      paidBlocks = blocks;
      break;
    case "marker": {
      const idx = blocks.findIndex(
        (b) => b.type === "html" && MARKER_RE.test((b as { value: string }).value.trim()),
      );
      if (idx === -1) {
        // 历史异常内容也 fail closed；发布入口会拒绝缺失标记。
        freeBlocks = [];
        paidBlocks = blocks;
      } else {
        freeBlocks = blocks.slice(0, idx);
        paidBlocks = blocks.slice(idx + 1);
      }
      break;
    }
    case "percent": {
      const p = percent ?? 0;
      const total = blocks.reduce((acc, b) => acc + blockWeight(b, markdown, mediaWeight), 0);
      const budget = (total * p) / 100;
      let acc = 0;
      let cut = 0;
      for (const b of blocks) {
        const w = blockWeight(b, markdown, mediaWeight);
        if (acc + w <= budget) {
          acc += w;
          cut += 1;
        } else {
          break; // 媒体块原子：绝不截断一半
        }
      }
      freeBlocks = blocks.slice(0, cut);
      paidBlocks = blocks.slice(cut);
      const boundary = blocks[cut];
      if (boundary?.type === "paragraph" || boundary?.type === "heading") {
        const partial = textPrefix(boundary, Math.floor(budget - acc));
        if (partial) freeBlocks.push(partial);
      }
      break;
    }
  }

  const freeTree: Root = { type: "root", children: freeBlocks };
  const paidTree: Root = { type: "root", children: paidBlocks };
  const freeMediaIds = collectStoredMediaIds(freeTree);
  const paidMediaIds = collectStoredMediaIds(paidTree);

  return {
    freeMarkdown: stringifyMarkdown(freeTree),
    freeMediaIds,
    hasPaidContent: paidBlocks.length > 0,
    allMediaIds: [...new Set([...freeMediaIds, ...paidMediaIds])],
  };
}

/** 归一化序列化 AST 为 Markdown（含 directive 支持）。 */
export function stringifyMarkdown(tree: Root): string {
  return toMarkdown(tree, { extensions: [directiveToMarkdown()] }).trim();
}
