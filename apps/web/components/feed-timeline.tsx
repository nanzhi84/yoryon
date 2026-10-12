import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TrackClickLink, TrackImpression } from "@/components/analytics";
import type { CollectionListItem, FeedContentItem, FeedItem } from "@/lib/types";

export const TYPE_LABEL: Record<FeedContentItem["type"], string> = {
  article: "文章",
  image: "图集",
  video: "视频",
  audio: "音频",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Singapore" });
}

/** 信息流内容条目：标题 + 日期 / 封面 + 简介 / 类型 + 标签，点进详情。 */
function ContentEntry({ item, showPinnedBadge = false }: { item: FeedContentItem; showPinnedBadge?: boolean }) {
  return (
    <TrackImpression targetKind="work" targetId={item.id}>
      <article className="group py-6">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className="min-w-0">
              <h2 className="truncate text-lg font-medium leading-snug group-hover:underline underline-offset-4">
                {item.title}
              </h2>
            </TrackClickLink>
            {showPinnedBadge && item.isPinned && (
              <Badge variant="secondary" className="shrink-0">
                置顶
              </Badge>
            )}
          </div>
          <time className="shrink-0 text-sm text-muted-foreground">{formatDate(item.publishedAt)}</time>
        </div>
        {item.coverMediaId && (
          <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className="mt-3 block">
            {/* 受控比例容器（明确的 UI 裁切选择）+ 加载前占位，消除封面 CLS（F08） */}
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicImageUrl(item.coverMediaId)} srcSet={imageSrcSet(item.coverMediaId, undefined, true)} sizes="(max-width: 768px) 100vw, 768px" alt={item.title} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </TrackClickLink>
        )}
      {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{TYPE_LABEL[item.type]}</span>
        {item.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
        {item.tags.map((t) => (
          <Link prefetch={false} key={t.slug} href={`/tags/${t.slug}`} className="hover:text-foreground">
            #{t.name}
          </Link>
        ))}
      </div>
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
    <>
      {items.map((item) => (
        <ContentEntry key={item.id} item={item} showPinnedBadge={showPinnedBadge} />
      ))}
    </>
  );
}
