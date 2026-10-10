import { apiFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { FeedTimeline } from "@/components/feed-timeline";
import { LoadMore } from "@/components/load-more";

/** 公开线：信息流可公开缓存（ADR-0003）。 */
export const revalidate = 60;

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);

export default async function HomePage() {
  let data: FeedResponse = { items: [], nextCursor: null };
  try {
    const res = await apiFetch("/api/feed", { revalidate: revalidateSec });
    if (res.ok) data = (await res.json()) as FeedResponse;
  } catch {
    // API 暂不可达（如构建期预渲染）：展示空态，运行时请求会重试
  }

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
