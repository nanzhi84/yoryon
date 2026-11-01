"use client";
import Link from "next/link";
import type { Listing } from "@/lib/listing";
import { chapterHref } from "@/lib/collection-links";
import { formatDate } from "@/lib/date";
import { FeedTimeline, CollectionEntry } from "./feed-timeline";
export function ListingItems({ chunk, lastId }: { chunk: Listing; lastId?: string | undefined }) {
  if (chunk.kind === "feed") return <div className="divide-y divide-border"><FeedTimeline items={chunk.items} showPinnedBadge={chunk.pinned} /></div>;
  if (chunk.kind === "collections") return <div className="divide-y divide-border">{chunk.items.map(item => <CollectionEntry key={item.id} item={item} />)}</div>;
  if (chunk.kind === "tags") return <ul className="flex flex-wrap gap-x-6 gap-y-4 py-2">
    {chunk.items.map(tag => <li key={tag.slug}><Link href={`/tags/${tag.slug}`} prefetch className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary">#{tag.name}<span className="text-muted-foreground">{tag.count}</span></Link></li>)}
  </ul>;
  return <ol className="divide-y divide-border" start={(chunk.page - 1) * 12 + 1}>
    {chunk.items.map(item => <li key={item.id} className={item.id === lastId ? "rounded-md bg-primary/5" : ""}>
      <Link prefetch href={chapterHref(item.slug, chunk.slug)} className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary">
        <span className="min-w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{String(item.position).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1 break-words">{item.title || item.slug}{item.id === lastId && <span className="ml-2 text-xs text-primary">上次阅读</span>}</span>
        <time dateTime={item.publishedAt ?? undefined} className="shrink-0 text-xs text-muted-foreground">{formatDate(item.publishedAt)}</time>
      </Link>
    </li>)}
  </ol>;
}
