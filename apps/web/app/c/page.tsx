import type { Metadata } from "next";
import { publicFetch } from "@/lib/api";
import type { CollectionListItem } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { CollectionEntry } from "@/components/feed-timeline";
import { AnalyticsListProvider } from "@/components/analytics";

export const metadata: Metadata = { title: "合集" };

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 86400);

export default async function CollectionsPage() {
  const res = await publicFetch("/api/collections", { revalidate: revalidateSec, tags: ["collections"] });
  if (!res.ok) throw new Error(`collections API ${res.status}`);
  const data = await res.json() as { items: CollectionListItem[]; version: string };
  const items = data.items;

  return (
    <>
      <SiteHeader />
      <main data-catalog-version={data.version}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">还没有合集。</p>
        ) : (
          // 合集列表是合集的唯一列表曝光面（feed 纯内容流），placement=collection_list
          <AnalyticsListProvider placement="collection_list">
            <div className="divide-y divide-border">
              {items.map((c) => (
                <CollectionEntry key={c.slug} item={c} />
              ))}
            </div>
          </AnalyticsListProvider>
        )}
      </main>
    </>
  );
}
