import Link from "next/link";
import { Lock } from "lucide-react";
import { ArticleSummary } from "./article-summary";
import type { ContentDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "@/components/markdown";

export function ContentBody({ content, publicImages = false }: { content: ContentDetail; publicImages?: boolean }) {
  /** 正文图片尺寸表（F08）：消费媒体尺寸元数据，img 预留纵横比避免加载撑开页面 */
  const mediaSizes: Record<string, { width: number; height: number; mimeType?: string }> = {};
  for (const m of content.media) {
    if (m.width && m.height) mediaSizes[m.mediaId] = { width: m.width, height: m.height, mimeType: m.mimeType };
  }

  return <>
        <ArticleSummary description={content.description} markdown={content.bodyMarkdown} />
        {/* 正文（已按权益裁剪） */}
        {content.bodyMarkdown && (
          <div className="mt-5" data-search-content={content.slug} data-search-revision={content.access === "full" ? content.revision : "preview"}>
            <MarkdownBody preserveBlankLines={content.type === "post"} markdown={content.bodyMarkdown} mediaSizes={mediaSizes} publicImages={publicImages} />
          </div>
        )}

        {/* 付费墙：统一商品为标准订阅（¥29.9/月全站解锁，到期回落锁定），唯一入口为激活码兑换 */}
        {content.access === "preview" && content.hasPaidContent && (
          <div className="mt-10 rounded-lg border border-dashed border-border p-6 text-center">
            <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">本内容为订阅专享，以上为免费预览。</p>
            <p className="mt-1 text-sm text-muted-foreground">
              标准订阅 ¥29.9/月：解锁站内全部付费内容，到期自动恢复锁定。
            </p>
            <Button asChild className="mt-4">
              <Link prefetch={false} href="/redeem">兑换订阅激活码</Link>
            </Button>
          </div>
        )}
  </>;
}
