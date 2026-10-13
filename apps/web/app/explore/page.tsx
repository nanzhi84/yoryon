import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { publicFetch } from "@/lib/api";
export const metadata = { title: "探索" };
export default async function ExplorePage() {
  const res = await publicFetch("/api/tags", { revalidate: 86400, tags: ["feed"] });
  if (!res.ok) throw new Error(`tags API ${res.status}`);
  const data = await res.json() as { tags: { slug: string; name: string; count: number }[] };
  return <><SiteHeader /><main className="space-y-8 py-8"><h1 className="text-2xl font-semibold">探索</h1>
    <section><h2 className="mb-3 text-lg font-medium">合集</h2><Link href="/c" prefetch={false} className="underline underline-offset-4">浏览全部合集 →</Link></section>
    <section id="tags" className="scroll-mt-6"><h2 className="mb-3 text-lg font-medium">标签</h2>{data.tags.length ? <ul className="flex flex-wrap gap-4">{data.tags.map(t => <li key={t.slug}><Link href={`/tags/${t.slug}`} prefetch={false} className="text-sm hover:underline">#{t.name} <span className="text-muted-foreground">{t.count}</span></Link></li>)}</ul> : <p className="text-sm text-muted-foreground">还没有标签。</p>}</section>
  </main></>;
}
