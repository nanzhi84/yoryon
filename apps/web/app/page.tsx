import { publicFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { LoadMore } from "@/components/load-more";
import { AnalyticsListProvider } from "@/components/analytics";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);

async function getFeed(): Promise<FeedResponse | null> {
  try {
    const res = await publicFetch("/api/feed", { revalidate: revalidateSec });
    if (!res.ok) return null;
    return (await res.json()) as FeedResponse;
  } catch {
    return null;
  }
}

/** 首页：纯内容信息流（合集为顶层结构，仅在 /c 列表展示，不混入 feed）。容器宽度由 layout 统一控制。 */
export default async function HomePage() {
  const feed = await getFeed();
  const items = feed?.items ?? [];

  return (
    <>
      <SiteHeader />
      <main className="pb-20">
        {items.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">还没有内容，敬请期待。</p>
        ) : (
          // 首页列表浏览实例：其下所有卡片共享 placement=home_feed 与实例 id（含 LoadMore 追加部分）
          <AnalyticsListProvider placement="home_feed">
            <div className="divide-y divide-border">
              <FeedTimeline items={items} />
            </div>
            {feed?.nextCursor && <LoadMore initialCursor={feed.nextCursor} />}
          </AnalyticsListProvider>
        )}
      </main>
    </>
  );
}
