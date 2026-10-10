import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FeedContentItem, FeedItem } from "@/lib/types";

export const TYPE_LABEL: Record<string, string> = {
  article: "文章",
  image: "图片",
  video: "视频",
  audio: "音频",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function ContentEntry({ item }: { item: FeedContentItem }) {
  return (
    <article className="group py-6">
      <div className="flex items-baseline justify-between gap-4">
        <Link href={`/p/${item.slug}`} className="min-w-0">
          <h2 className="truncate text-lg font-medium leading-snug group-hover:underline underline-offset-4">
            {item.title}
          </h2>
        </Link>
        <time className="shrink-0 text-sm text-muted-foreground">{formatDate(item.publishedAt)}</time>
      </div>
      {item.coverMediaId && (
        <Link href={`/p/${item.slug}`} className="mt-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${item.coverMediaId}`} alt={item.title} loading="lazy" className="max-h-64 w-full rounded-lg object-cover" />
        </Link>
      )}
      {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{TYPE_LABEL[item.type]}</span>
        {item.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
        {item.tags.map((t) => (
          <Link key={t.slug} href={`/tags/${t.slug}`} className="hover:text-foreground">
            #{t.name}
          </Link>
        ))}
      </div>
    </article>
  );
}

/** 轻量时间线条目：分隔线 + 留白，不套 Card（ADR-0005 §8.3）。 */
export function FeedTimeline({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">还没有内容。</p>;
  }
  return (
    <div className="divide-y divide-border">
      {items.map((item) =>
        item.kind === "content" ? (
          <ContentEntry key={`c-${item.id}`} item={item} />
        ) : (
          <article key={`col-${item.id}`} className="group py-6">
            <div className="flex items-baseline justify-between gap-4">
              <Link href={`/c/${item.slug}`} className="min-w-0">
                <h2 className="truncate text-lg font-medium leading-snug group-hover:underline underline-offset-4">
                  合集 · {item.title}
                </h2>
              </Link>
              <span className="shrink-0 text-sm text-muted-foreground">{item.itemCount} 篇</span>
            </div>
            {item.coverMediaId && (
              <Link href={`/c/${item.slug}`} className="mt-3 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${item.coverMediaId}`} alt={item.title} loading="lazy" className="max-h-64 w-full rounded-lg object-cover" />
              </Link>
            )}
            {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>合集</span>
              {item.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
            </div>
          </article>
        ),
      )}
    </div>
  );
}
