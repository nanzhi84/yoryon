"use client";
import type { ContentDetail } from "@/lib/types";
import { MarkdownSurface } from "./markdown-surface";

/** 私有全文在浏览器同步渲染，不载入服务端 Shiki/异步组件。 */
export function PrivateBody({ content }: { content: ContentDetail }) {
  const mediaSizes = Object.fromEntries(content.media.filter(m => m.width && m.height).map(m => [m.mediaId, { width: m.width!, height: m.height!, mimeType: m.mimeType }]));
  return <div className="mt-8"><MarkdownSurface markdown={content.bodyMarkdown} mediaSizes={mediaSizes} /></div>;
}
