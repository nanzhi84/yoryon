import { ArticleSummary } from "./article-summary";
import { ChapterReading } from "./chapter-reading";
import type { ContentDetail } from "@/lib/types";
import { MarkdownBody } from "./markdown";
export function ContentBody({ content }: { content: ContentDetail }) {
  const mediaSizes = Object.fromEntries(content.media.map((m) => [m.mediaId, m]));
  return (
    <>
      <ChapterReading contentId={content.id} />
      <ArticleSummary description={content.description} markdown={content.bodyMarkdown} />
      {content.bodyMarkdown && (
        <div className="mt-5" data-search-content={content.slug}>
          <MarkdownBody
            preserveBlankLines={content.type === "post"}
            markdown={content.bodyMarkdown}
            mediaSizes={mediaSizes}
          />
        </div>
      )}
      {content.access === "preview" && content.hasPaidContent && (
        <p className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
          本篇目前仅提供公开预览。
        </p>
      )}
    </>
  );
}
