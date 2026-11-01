import { notFound } from "next/navigation";
import { collectionList, getCollections, staticDataRoot } from "@/lib/static-site";
import { collectionPaths, collectionRoute } from "@/lib/collection-routes";
import { PAGE_SIZE, pageItems, pagePath } from "@/lib/pagination";
import { SiteHeader } from "@/components/site-header";
import { CollectionEntry } from "@/components/feed-timeline";
import { CollectionReader } from "@/components/collection-reader";
import { CollectionDescription } from "@/components/collection-description";
import { Pagination } from "@/components/pagination";
import { pageMetadata } from "@/lib/seo";
import { collectionStructuredData } from "@/lib/seo-structured";
import { StructuredData } from "@/components/structured-data";
type Props = { params: Promise<{ slug?: string[] }> };
export const dynamicParams = false;
export function generateStaticParams() { return collectionPaths().map(p => ({ slug: p.split("/").slice(2) })); }
export async function generateMetadata({ params }: Props) {
  const route = collectionRoute((await params).slug ?? []);
  if (!route) return { title: "合集不存在", robots: { index: false } };
  const { collection, page, base } = route;
  return pageMetadata(pagePath(base, page), collection ? collection.title : "合集", collection?.description ?? "Yoryon 的合集与文章目录。");
}
export default async function Page({ params }: Props) {
  const route = collectionRoute((await params).slug ?? []);
  if (!route) notFound();
  const { collection, page, reverse, base } = route;
  if (collection) {
    const rows = pageItems(collection.items, page, reverse);
    if (!rows) notFound();
    const offset = (page - 1) * PAGE_SIZE;
    const chapter = (item: typeof collection.items[number], position: number) => ({
      id: item.id, slug: item.slug, title: item.title, publishedAt: item.publishedAt, position,
    });
    const items = rows.map((item, index) => chapter(item, reverse ? collection.items.length - offset - index : offset + index + 1));
    return <>
      <StructuredData data={collectionStructuredData(collection, rows, items.map(i => i.position), pagePath(base, page))} />
      <SiteHeader />
      <CollectionReader collection={{ id: collection.id, slug: collection.slug, title: collection.title, updatedAt: collection.updatedAt, total: collection.items.length }}
        items={items} first={collection.items[0] ? chapter(collection.items[0], 1) : null} page={page} reverse={reverse}
        lookup={`${staticDataRoot()}/collections/${collection.id}`}
        description={collection.description ? <CollectionDescription description={collection.description} className="mt-3" /> : null} />
    </>;
  }
  const all = getCollections();
  const rows = pageItems(all, page);
  if (!rows) notFound();
  return <><SiteHeader /><main>
    {rows.length ? <div className="divide-y divide-border">{rows.map(c => <CollectionEntry key={c.id} item={collectionList(c)} />)}</div>
      : <p className="py-6 text-center text-sm text-muted-foreground">暂无公开合集。</p>}
    <Pagination base="/c" page={page} total={all.length} />
  </main></>;
}
