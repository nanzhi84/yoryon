import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TrackClickLink, TrackImpression } from "@/components/analytics";
import type { CollectionListItem, FeedContentItem, FeedItem } from "@/lib/types";
import { PostEntry } from "./post-entry";
import { ContentActions, ContentInteractions } from "./content-actions";
import { ArrowRight } from "lucide-react";

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Singapore" }).replaceAll("/", ".");
}

/** 信息流内容条目：标题 + 日期 / 封面 + 简介 / 类型 + 标签，点进详情。 */
function ContentEntry({ item, showPinnedBadge = false }: { item: FeedContentItem; showPinnedBadge?: boolean }) {
  return (
    <TrackImpression targetKind="work" targetId={item.id}>
      <article className="editorial-entry group py-5">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className="min-w-0">
              <h2 className="line-clamp-2 text-lg font-semibold leading-[26px] group-hover:underline underline-offset-4">
                {item.title || "未命名内容"}
              </h2>
            </TrackClickLink>
            {showPinnedBadge && item.isPinned && (
              <Badge variant="secondary" className="shrink-0">
                置顶
              </Badge>
            )}
            {item.visibility === "paid" && <Badge variant="secondary" className="shrink-0 text-primary">付费</Badge>}
          </div>
          <time dateTime={item.publishedAt ?? undefined} className="shrink-0 text-xs leading-[18px] text-muted-foreground">{formatDate(item.publishedAt)}</time>
        </div>
        {item.type === "article" ? <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {(item.description || item.excerpt) && <p className="editorial-excerpt line-clamp-3 text-[15px] leading-6 text-foreground">{item.description || item.excerpt}</p>}
            <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-[13px] leading-5 text-primary hover:underline underline-offset-4">
              阅读全文 <ArrowRight className="size-4" aria-hidden="true" />
            </TrackClickLink>
          </div>
          {item.coverMediaId && <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className="block w-28 shrink-0 sm:w-36">
            {/* 受控比例容器（明确的 UI 裁切选择）+ 加载前占位，消除封面 CLS（F08） */}
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicImageUrl(item.coverMediaId)} srcSet={imageSrcSet(item.coverMediaId, undefined, true)} sizes="144px" alt={item.title} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </TrackClickLink>}
        </div> : <PostEntry item={item} />}
      <ContentActions id={item.id} slug={item.slug} />
      </article>
    </TrackImpression>
  );
}

/** 合集条目：仅用于 /c 合集列表页（首页 feed 不混入合集）。 */
export function CollectionEntry({ item }: { item: CollectionListItem }) {
  return (
    <TrackImpression targetKind="collection" targetId={item.id}>
      <article className="group py-6">
        <div className="flex items-baseline justify-between gap-4">
          <TrackClickLink targetKind="collection" targetId={item.id} href={`/c/${item.slug}`} className="min-w-0">
            <h2 className="truncate text-lg font-medium leading-snug group-hover:underline underline-offset-4">
              {item.title}
            </h2>
          </TrackClickLink>
          <time className="shrink-0 text-sm text-muted-foreground">{formatDate(item.updatedAt)}</time>
        </div>
      {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>合集 · {item.itemCount} 篇内容</span>
        {item.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
      </div>
      </article>
    </TrackImpression>
  );
}

/** 时间线：按 publishedAt 排序的内容列表，极简分隔线风格（父容器加 divide-y divide-border）。
 *  showPinnedBadge 仅首页开启：置顶是 feed 排序语义，标签页不显示标记。 */
export function FeedTimeline({ items, showPinnedBadge = false }: { items: FeedItem[]; showPinnedBadge?: boolean }) {
  return (
    <ContentInteractions ids={items.map(item => item.id)}>
      {items.map((item) => (
        <ContentEntry key={item.id} item={item} showPinnedBadge={showPinnedBadge} />
      ))}
    </ContentInteractions>
  );
}
