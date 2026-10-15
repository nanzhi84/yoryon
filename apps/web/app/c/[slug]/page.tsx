import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { CollectionDetail } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { CollectionReader } from "@/components/collection-reader";
import { pageMetadata } from "@/lib/seo";
import { collectionStructuredData } from "@/lib/seo-structured";
import { StructuredData } from "@/components/structured-data";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCollection(slug: string): Promise<CollectionDetail | null> {
  const res = await apiFetch(`/api/collections/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as CollectionDetail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "合集不存在", robots: { index: false } };
  return pageMetadata(`/c/${collection.slug}`, collection.title, collection.description);
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  return <><StructuredData data={collectionStructuredData(collection)} /><SiteHeader /><CollectionReader key={collection.id} initial={collection} /></>;
}
