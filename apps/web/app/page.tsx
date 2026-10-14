import { fetchCatalog } from "@/lib/public-catalog";
import type { FeedResponse } from "@/lib/types";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { LoadMore } from "@/components/load-more";
import { AnalyticsListProvider } from "@/components/analytics";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 86400);

/** 首页以真实内容时间线为主；合集仍仅在 /c 展示，底部提示进入订阅页。 */
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
          <p className="py-20 text-center text-sm text-muted-foreground">还没有内容，敬请期待。</p>
        ) : (
          // 首页列表浏览实例：其下所有卡片共享 placement=home_feed 与实例 id（含 LoadMore 追加部分）
          <AnalyticsListProvider placement="home_feed">
            <div className="divide-y divide-border">
              <FeedTimeline items={items} showPinnedBadge />
            </div>
            {feed?.nextCursor && <LoadMore version={feed.version} initialCursor={feed.nextCursor} showPinnedBadge />}
          </AnalyticsListProvider>
        )}
        <section aria-label="订阅支持" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border px-5 py-5">
          <p className="text-sm font-medium">更深入的作品，更直接的交流。</p>
          <Link href="/subscription" prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            了解订阅 <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </>
  );
}
