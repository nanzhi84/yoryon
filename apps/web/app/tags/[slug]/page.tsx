import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCatalog } from "@/lib/public-catalog";
import type { TagDetailResponse } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { FeedTimeline } from "@/components/feed-timeline";
import { LoadMore } from "@/components/load-more";
import { BackButton } from "@/components/back-button";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 86400);

interface Props {
  params: Promise<{ slug: string }>;
}

async function getTag(slug: string): Promise<TagDetailResponse | null> {
  const res = await fetchCatalog(`/api/tags/${encodeURIComponent(slug)}`, { revalidate: revalidateSec, tags: [`tag:${slug}`] });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as TagDetailResponse;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTag(slug);
  if (!data) return { title: "标签不存在" };
  return { title: `#${data.tag.name}` };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const data = await getTag(slug);
  if (!data) notFound();

  return (
    <>
      <SiteHeader />
      <main data-catalog-version={data.version} className="py-5">
        <BackButton fallback="/tags" />
        <h1 className="text-2xl font-semibold">#{data.tag.name}</h1>
        <div className="mt-4">
          <FeedTimeline items={data.items} />
          {data.nextCursor && <LoadMore version={data.version} basePath={`/api/tags/${slug}`} initialCursor={data.nextCursor} />}
        </div>
      </main>
    </>
  );
}
