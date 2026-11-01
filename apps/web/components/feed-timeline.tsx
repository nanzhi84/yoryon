"use client";
import Link from "next/link";
import { ReaderLink } from "./reader-navigation";
import { Badge } from "./ui/badge";
import type { CollectionRow, FeedRow } from "@/lib/listing";
import { formatDate } from "@/lib/date";
import { ListingRichText } from "./listing-rich-text";
import { PostEntry } from "./post-entry";
export function ContentEntry({
  item,
  showPinnedBadge = false,
}: {
  item: FeedRow;
  showPinnedBadge?: boolean;
}) {
  const date = (
    <time
      dateTime={item.publishedAt ?? undefined}
      className="block text-xs leading-[18px] text-muted-foreground"
    >
      {formatDate(item.publishedAt)}
    </time>
  );
  return (
    <article className="editorial-entry group py-5">
      {item.type === "article" ? (
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <ReaderLink
              item={{ slug: item.slug, title: item.title, publishedAt: item.publishedAt }}
              className="min-w-0"
            >
              <h2 className="line-clamp-2 text-lg font-semibold leading-[26px] group-hover:underline underline-offset-4">
                {item.title || "未命名内容"}
              </h2>
            </ReaderLink>
            {showPinnedBadge && item.isPinned && <Badge variant="secondary">置顶</Badge>}
          </div>
          <p className="editorial-excerpt mt-2 line-clamp-3 break-words text-[15px] leading-6 text-muted-foreground">
            {item.description || item.excerpt}
          </p>
          <div className="mt-3">{date}</div>
        </div>
      ) : (
        <>
          {showPinnedBadge && item.isPinned && <Badge variant="secondary">置顶</Badge>}
          <PostEntry id={item.id}>
            <div data-search-body className="prose prose-zinc dark:prose-invert prose-yoryon max-w-none prose-feed prose-post">
              <ListingRichText nodes={item.body ?? []} />
            </div>
          </PostEntry>
          <Link
            prefetch={false}
            href={`/p/${item.slug}`}
            aria-label={`查看 ${formatDate(item.publishedAt)} 的帖子详情`}
            className="mt-3 block w-fit hover:underline"
          >
            {date}
          </Link>
        </>
      )}
    </article>
  );
}
export function CollectionEntry({ item }: { item: CollectionRow }) {
  return (
    <article className="group py-5">
      <Link prefetch={true} href={`/c/${item.slug}`} className="block">
        <h2 className="text-lg font-medium leading-[26px] group-hover:underline underline-offset-4">
          {item.title}
        </h2>
      </Link>
      <div className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-muted-foreground [&_p+p]:mt-0">
        <ListingRichText nodes={item.introduction} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[18px] text-muted-foreground">
        <span>合集 · {item.itemCount} 篇内容</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.updatedAt}>更新于 {formatDate(item.updatedAt)}</time>
        {item.isPinned && <Badge variant="secondary">置顶</Badge>}
      </div>
    </article>
  );
}
export function FeedTimeline({
  items,
  showPinnedBadge = false,
}: {
  items: FeedRow[];
  showPinnedBadge?: boolean;
}) {
  return (
    <>
      {items.map((item) => (
        <ContentEntry key={item.id} item={item} showPinnedBadge={showPinnedBadge} />
      ))}
    </>
  );
}
