import type { Metadata } from "next";
import { fetchCatalog } from "@/lib/public-catalog";
import type { FeedResponse } from "@/lib/types";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { LoadMore } from "@/components/load-more";
import { AnalyticsListProvider } from "@/components/analytics";

export const metadata: Metadata = { title: "帖子" };
const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 86400);

export default async function PostsPage() {
  const res = await fetchCatalog("/api/post-feed", { revalidate: revalidateSec, tags: ["feed"] });
  if (!res.ok) throw new Error(`post feed API ${res.status}`);
  const feed = await res.json() as FeedResponse;
  return <>
    <SiteHeader />
    <main data-catalog-version={feed.version} className="pb-20">
      {feed.items.length === 0 ? <p className="py-20 text-center text-sm text-muted-foreground">还没有帖子，敬请期待。</p>
        : <AnalyticsListProvider placement="post_feed">
          <div className="divide-y divide-border"><FeedTimeline items={feed.items} showPinnedBadge /></div>
          {feed.nextCursor && <LoadMore version={feed.version} initialCursor={feed.nextCursor} basePath="/api/post-feed" showPinnedBadge />}
        </AnalyticsListProvider>}
    </main>
  </>;
}
