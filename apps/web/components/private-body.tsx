"use client";
import { Suspense } from "react";
import { WorkBodyTracker } from "./analytics";
import { ChapterReading } from "./chapter-reading";
import { ArticleSummary } from "./article-summary";
import type { ContentDetail } from "@/lib/types";
import { MarkdownSurface } from "./markdown-surface";

/** 私有全文在浏览器同步渲染，不载入服务端 Shiki/异步组件。 */
export function PrivateBody({ content }: { content: ContentDetail }) {
  const mediaSizes = Object.fromEntries(content.media.filter(m => m.width && m.height).map(m => [m.mediaId, { width: m.width!, height: m.height!, mimeType: m.mimeType }]));
  return <><Suspense fallback={null}><WorkBodyTracker /><ChapterReading contentId={content.id} /></Suspense><ArticleSummary description={content.description} markdown={content.bodyMarkdown} /><div data-search-content={content.slug} data-search-revision={content.revision} className="mt-5"><MarkdownSurface preserveBlankLines={content.type === "post"} markdown={content.bodyMarkdown} mediaSizes={mediaSizes} /></div></>;
}
