import { apiFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { FeedTimeline } from "@/components/feed-timeline";
import { LoadMore } from "@/components/load-more";

/** 公开线：信息流可公开缓存（ADR-0003）。 */
export const revalidate = 60;

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);

export default async function HomePage() {
  const res = await apiFetch("/api/feed", { revalidate: revalidateSec });
  const data = res.ok ? ((await res.json()) as FeedResponse) : { items: [], nextCursor: null };

  return (
    <>
      <SiteHeader />
      <main>
        <FeedTimeline items={data.items} />
        {data.nextCursor && <LoadMore initialCursor={data.nextCursor} />}
      </main>
    </>
  );
}
