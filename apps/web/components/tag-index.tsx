import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "./site-header";
import { BackButton } from "./back-button";
import { Pagination } from "./pagination";
import { getTags } from "@/lib/static-site";
import { pageItems } from "@/lib/pagination";
export function TagIndex({ page = 1 }: { page?: number }) {
  const all = getTags();
  const rows = pageItems(all, page);
  if (!rows) notFound();
  return <><SiteHeader /><main className="py-5"><BackButton /><h1 className="text-2xl font-semibold">标签</h1>
    {rows.length ? <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
      {rows.map(tag => <li key={tag.slug}><Link href={`/tags/${tag.slug}`} prefetch className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary">#{tag.name}<span className="text-muted-foreground">{tag.count}</span></Link></li>)}
    </ul> : <p className="py-6 text-sm text-muted-foreground">还没有标签。</p>}
    <Pagination base="/tags" page={page} total={all.length} />
  </main></>;
}
