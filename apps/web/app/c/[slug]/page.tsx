import { notFound } from "next/navigation";
import { getCollection, getCollections } from "@/lib/static-site";
import { SiteHeader } from "@/components/site-header";
import { CollectionReader } from "@/components/collection-reader";
import { pageMetadata } from "@/lib/seo";
import { collectionStructuredData } from "@/lib/seo-structured";
import { StructuredData } from "@/components/structured-data";
interface Props {
  params: Promise<{ slug: string }>;
}
export const dynamicParams = false;
export function generateStaticParams() {
  return getCollections().map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({ params }: Props) {
  const c = getCollection((await params).slug);
  return c
    ? pageMetadata(`/c/${c.slug}`, c.title, c.description)
    : { title: "合集不存在", robots: { index: false } };
}
export default async function CollectionPage({ params }: Props) {
  const c = getCollection((await params).slug);
  if (!c) notFound();
  return (
    <>
      <StructuredData data={collectionStructuredData(c)} />
      <SiteHeader />
      <CollectionReader initial={c} />
    </>
  );
}
