import { apiFetch } from "@/lib/api";
import { fetchCatalog } from "@/lib/public-catalog";
import type { MemberFeedResponse, Membership } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { MembershipPanel } from "@/components/membership-panel";
import { MemberTimeline } from "@/components/member-timeline";
import { LoadMore } from "@/components/load-more";
export const metadata = { title: "订阅" };
export const dynamic = "force-dynamic";
export default async function SubscriptionPage() {
  const [state, feedRes] = await Promise.all([
    apiFetch("/api/me/membership").catch(() => null),
    fetchCatalog("/api/member-feed", { revalidate: 86400, tags: ["feed", "collections"] }),
  ]);
  if (!feedRes.ok) throw new Error(`paid feed API ${feedRes.status}`);
  const feed = await feedRes.json() as MemberFeedResponse;
  const membership = state?.ok ? await state.json() as Membership : null;
  return <><SiteHeader /><main data-catalog-version={feed.version} className="py-5 pb-20">
    <MembershipPanel initial={membership} authenticated={!!state?.ok} unavailable={!state || (!state.ok && state.status !== 401)} works={<section aria-label="会员作品"><h2 className="sr-only">会员作品</h2>
      {feed.items.length ? <div className="divide-y divide-border"><MemberTimeline items={feed.items} /></div> : <p className="py-8 text-sm text-muted-foreground">还没有会员作品。</p>}
      {feed.nextCursor && <LoadMore basePath="/api/member-feed" version={feed.version} initialCursor={feed.nextCursor} />}
    </section>} />
  </main></>;
}
