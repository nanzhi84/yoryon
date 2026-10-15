import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BackButton } from "@/components/back-button";
import { publicFetch } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/tags", "标签", "按标签浏览 Yoryon 的文章与帖子。");
export default async function TagsPage() {
  const response = await publicFetch("/api/tags", { revalidate: 86400, tags: ["feed"] });
  if (!response.ok) throw new Error(`tags API ${response.status}`);
  const data = await response.json() as { tags: { slug: string; name: string; count: number }[] };
  return <><SiteHeader /><main className="py-5"><BackButton /><h1 className="text-2xl font-semibold">标签</h1>
    {data.tags.length ? <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-4">{data.tags.map(tag => <li key={tag.slug}><Link href={`/tags/${tag.slug}`} prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary">#{tag.name}<span className="text-muted-foreground">{tag.count}</span></Link></li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">还没有标签。</p>}
  </main></>;
}
