import { notFound } from "next/navigation";
import { collectionList, getCollection, getCollections } from "@/lib/static-site";
import { SiteHeader } from "@/components/site-header";
import { CollectionEntry } from "@/components/feed-timeline";
import { CollectionReader } from "@/components/collection-reader";
import { pageMetadata } from "@/lib/seo";
import { collectionStructuredData } from "@/lib/seo-structured";
import { StructuredData } from "@/components/structured-data";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export const dynamicParams = false;

// The directory index is a real export target even when no collections are public.
export function generateStaticParams() {
  return [{ slug: [] }, ...getCollections().map((collection) => ({ slug: [collection.slug] }))];
}

export async function generateMetadata({ params }: Props) {
  const { slug = [] } = await params;
  if (!slug.length) return pageMetadata("/c", "合集", "Yoryon 的合集与文章目录。");
  const collection = slug.length === 1 ? getCollection(slug[0]!) : null;
  return collection
    ? pageMetadata(`/c/${collection.slug}`, collection.title, collection.description)
    : { title: "合集不存在", robots: { index: false } };
}

export default async function CollectionsPage({ params }: Props) {
  const { slug = [] } = await params;
  if (slug.length) {
    const collection = slug.length === 1 ? getCollection(slug[0]!) : null;
    if (!collection) notFound();
    return (
      <>
        <StructuredData data={collectionStructuredData(collection)} />
        <SiteHeader />
        <CollectionReader initial={collection} />
      </>
    );
  }
  const collections = getCollections();
  return (
    <>
      <SiteHeader />
      <main>
        {collections.length ? (
          <div className="divide-y divide-border">
            {collections.map((collection) => (
              <CollectionEntry key={collection.id} item={collectionList(collection)} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无公开合集。</p>
        )}
      </main>
    </>
  );
}
