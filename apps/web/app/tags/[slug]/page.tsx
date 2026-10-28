import { notFound } from "next/navigation";
import { feed, getTags, getContents } from "@/lib/static-site";
import { SiteHeader } from "@/components/site-header";
import { FeedTimeline } from "@/components/feed-timeline";
import { BackButton } from "@/components/back-button";
import { pageMetadata } from "@/lib/seo";
interface Props {
  params: Promise<{ slug: string }>;
}
export const dynamicParams = false;
export function generateStaticParams() {
  return getTags().map((t) => ({ slug: t.slug }));
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tag = getTags().find((t) => t.slug === slug);
  return tag
    ? pageMetadata(`/tags/${tag.slug}`, `#${tag.name}`, `浏览带有「${tag.name}」标签的文章与帖子。`)
    : { title: "标签不存在" };
}
export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = getTags().find((t) => t.slug === slug);
  if (!tag) notFound();
  const items = feed(
    getContents().filter((c) => c.tags.some((t) => t.slug === slug)),
    false
  );
  return (
    <>
      <SiteHeader />
      <main className="py-5">
        <BackButton fallback="/tags" />
        <h1 className="text-2xl font-semibold">#{tag.name}</h1>
        <div className="mt-4">
          <FeedTimeline items={items} />
        </div>
      </main>
    </>
  );
}
