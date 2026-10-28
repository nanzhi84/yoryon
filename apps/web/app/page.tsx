import { feed, getContents } from "@/lib/static-site";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata, siteDescription } from "@/lib/seo";
export const metadata = {
  ...pageMetadata("/", "Yoryon", siteDescription),
  title: { absolute: "Yoryon" },
};
export default function HomePage() {
  const items = feed(getContents().filter((c) => c.type === "article" && c.showInHome));
  return (
    <>
      <SiteHeader />
      <main className="pb-20">
        {items.length ? (
          <div className="divide-y divide-border">
            <FeedTimeline items={items} showPinnedBadge />
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-muted-foreground">还没有文章，敬请期待。</p>
        )}
      </main>
    </>
  );
}
