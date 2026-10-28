import { getCollections, collectionList } from "@/lib/static-site";
import { SiteHeader } from "@/components/site-header";
import { CollectionEntry } from "@/components/feed-timeline";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/c", "合集", "Yoryon 的合集与文章目录。");
export default function CollectionsPage() {
  const items = getCollections();
  return (
    <>
      <SiteHeader />
      <main>
        {items.length ? (
          <div className="divide-y divide-border">
            {items.map((c) => (
              <CollectionEntry key={c.id} item={collectionList(c)} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">还没有合集。</p>
        )}
      </main>
    </>
  );
}
