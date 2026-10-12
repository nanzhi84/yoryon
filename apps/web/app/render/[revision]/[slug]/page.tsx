import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/public-content";
import { ContentView } from "@/components/content-view";

export const revalidate = 86400;
export function generateStaticParams() { return []; }
interface Props { params: Promise<{ slug: string; revision: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, revision } = await params;
  const content = await getPublicContent(slug, revision);
  if (!content) return { title: "内容不存在", robots: { index: false } };
  const canonical = `${process.env.SITE_URL}/p/${slug}`;
  return { title: content.title, description: content.description, alternates: { canonical }, openGraph: { title: content.title, description: content.description, url: canonical, type: "article", publishedTime: content.publishedAt ?? undefined } };
}
export default async function Page({ params }: Props) {
  const { slug, revision } = await params;
  const content = await getPublicContent(slug, revision);
  if (!content) notFound();
  const structured = { "@context": "https://schema.org", "@type": "Article", headline: content.title, description: content.description, datePublished: content.publishedAt, dateModified: content.updatedAt, url: `${process.env.SITE_URL}/p/${slug}`, isAccessibleForFree: content.visibility === "public" };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><ContentView key={revision} initial={content} /></>;
}
