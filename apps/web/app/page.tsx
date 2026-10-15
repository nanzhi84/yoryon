import { fetchCatalog } from "@/lib/public-catalog";
import type { FeedResponse } from "@/lib/types";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { LoadMore } from "@/components/load-more";
import { AnalyticsListProvider } from "@/components/analytics";
import { pageMetadata, siteDescription } from "@/lib/seo";

export const metadata = { ...pageMetadata("/", "Yoryon", siteDescription), title: { absolute: "Yoryon" } };

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 86400);

/** 首页只展示文章；帖子和合集各有独立入口。 */
export default async function HomePage() {
  const res = await fetchCatalog("/api/feed", { revalidate: revalidateSec, tags: ["feed"] });
  if (!res.ok) throw new Error(`feed API ${res.status}`);
  const feed = await res.json() as FeedResponse;
  const items = feed?.items ?? [];

  return (
    <>
      <SiteHeader />
      <main data-catalog-version={feed.version} className="pb-20">
        {items.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">还没有文章，敬请期待。</p>
        ) : (
          // 首页列表浏览实例：其下所有卡片共享 placement=home_feed 与实例 id（含 LoadMore 追加部分）
          <AnalyticsListProvider placement="home_feed">
            <div className="divide-y divide-border">
              <FeedTimeline items={items} showPinnedBadge />
            </div>
            {feed?.nextCursor && <LoadMore version={feed.version} initialCursor={feed.nextCursor} showPinnedBadge />}
          </AnalyticsListProvider>
        )}
      </main>
    </>
  );
}
