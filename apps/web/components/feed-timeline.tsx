import { ReaderLink } from "./reader-navigation";
import { Badge } from "@/components/ui/badge";
import { TrackClickLink, TrackImpression } from "@/components/analytics";
import type { CollectionListItem, FeedContentItem, FeedItem } from "@/lib/types";
import { ContentActions, ContentInteractions } from "./content-actions";
import { formatDate } from "@/lib/date";
import { PostAnalytics } from "./post-analytics";
import { CollectionDescription } from "./collection-description";
import { EntryCover } from "./entry-cover";
import { PostEntry } from "./post-entry";

/** 文章使用统一图文入口；帖子保留正文、媒体与原地展开。 */
export function ContentEntry({ item, showPinnedBadge = false }: { item: FeedContentItem; showPinnedBadge?: boolean }) {
  const Tracking = item.type === "post" ? PostAnalytics : ArticleAnalytics;
  const badges = <>
    {showPinnedBadge && item.isPinned && <Badge variant="secondary">置顶</Badge>}
    {item.visibility === "paid" && <Badge variant="secondary" className="text-primary">付费</Badge>}
  </>;
  const date = <time dateTime={item.publishedAt ?? undefined} className="block text-xs leading-[18px] text-muted-foreground">{formatDate(item.publishedAt)}</time>;
  return <Tracking id={item.id}>
    <article className="editorial-entry group py-5">
      {item.type === "article" ? <div className="flex items-stretch gap-4">
        <div className="min-w-0 flex-1 sm:flex sm:min-h-[162px] sm:flex-col">
          <div className="flex flex-wrap items-baseline gap-2">
            <ReaderLink item={item} className="min-w-0">
              <h2 className="line-clamp-2 text-lg font-semibold leading-[26px] group-hover:underline underline-offset-4">{item.title || "未命名内容"}</h2>
            </ReaderLink>
            {badges}
          </div>
          <p className="editorial-excerpt mt-2 h-[72px] line-clamp-3 break-words text-[15px] leading-6 text-muted-foreground">{item.description || item.excerpt}</p>
          <div className="mt-3 sm:mt-auto sm:pt-3">{date}</div>
        </div>
        <ReaderLink item={item} aria-label={`查看文章：${item.title || "未命名内容"}`} className="hidden h-[162px] w-[216px] shrink-0 self-end sm:flex">
          <EntryCover stretch mediaId={item.coverMediaId} title={item.title} />
        </ReaderLink>
      </div> : <>
        {(showPinnedBadge && item.isPinned || item.visibility === "paid") && <div className="mb-2 flex items-center gap-2">{badges}</div>}
        <PostEntry item={item} />
        <TrackClickLink enabled={false} targetKind="work" targetId={item.id} href={`/p/${item.slug}`} aria-label={`查看 ${formatDate(item.publishedAt)} 的帖子详情`} className="mt-3 block w-fit hover:underline">{date}</TrackClickLink>
      </>}
      <ContentActions id={item.id} slug={item.slug} trackClicks={item.type === "article"} />
    </article>
  </Tracking>;
}

function ArticleAnalytics({ id, children }: { id: string; children: React.ReactNode }) {
  return <TrackImpression targetKind="work" targetId={id}>{children}</TrackImpression>;
}

/** 合集列表与会员目录复用文章封面尺寸和图文节奏。 */
export function CollectionEntry({ item }: { item: CollectionListItem & { paidItemCount?: number } }) {
  return <TrackImpression targetKind="collection" targetId={item.id}>
    <article className="group py-5">
      <div className="flex items-stretch gap-4">
        <div className="min-w-0 flex-1 sm:flex sm:min-h-[162px] sm:flex-col">
          <TrackClickLink targetKind="collection" targetId={item.id} href={`/c/${item.slug}`} className="block">
            <h2 className="line-clamp-2 text-lg font-medium leading-[26px] group-hover:underline underline-offset-4">{item.title}</h2>
          </TrackClickLink>
          <CollectionDescription description={item.description || ""} className="mt-2 h-[72px] line-clamp-3 text-muted-foreground [&_p+p]:mt-0" />
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[18px] text-muted-foreground sm:mt-auto sm:pt-3">
            <span>{item.paidItemCount === undefined ? `合集 · ${item.itemCount} 篇内容` : `合集 · 共 ${item.itemCount} 篇 · ${item.paidItemCount} 篇会员`}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.updatedAt}>更新于 {formatDate(item.updatedAt)}</time>
            {item.paidItemCount === undefined && item.isPinned && <Badge variant="secondary">置顶</Badge>}
          </div>
        </div>
        <TrackClickLink targetKind="collection" targetId={item.id} href={`/c/${item.slug}`} aria-label={`查看合集：${item.title}`} className="hidden h-[162px] w-[216px] shrink-0 self-end sm:flex">
          <EntryCover stretch mediaId={item.coverMediaId} title={item.title} />
        </TrackClickLink>
      </div>
    </article>
  </TrackImpression>;
}

/** 各列表共享入口展示，查询端决定类型、置顶和排序。 */
export function FeedTimeline({ items, showPinnedBadge = false }: { items: FeedItem[]; showPinnedBadge?: boolean }) {
  return <ContentInteractions ids={items.map(item => item.id)}>
    {items.map(item => <ContentEntry key={item.id} item={item} showPinnedBadge={showPinnedBadge} />)}
  </ContentInteractions>;
}
