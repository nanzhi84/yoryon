import { feed, getContents } from "@/lib/static-site";
import { FeedTimeline } from "@/components/feed-timeline";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/posts", "帖子", "Yoryon 的帖子与随笔。");
export default function PostsPage() {
  const items = feed(getContents().filter((c) => c.type === "post" && c.showInHome));
  return (
    <>
      <SiteHeader />
      <main className="pb-20">
        {items.length ? (
          <div className="divide-y divide-border">
            <FeedTimeline items={items} showPinnedBadge />
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-muted-foreground">还没有帖子，敬请期待。</p>
        )}
      </main>
    </>
  );
}
