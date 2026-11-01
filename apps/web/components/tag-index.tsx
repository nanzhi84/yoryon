import { notFound } from "next/navigation";
import { SiteHeader } from "./site-header";
import { BackButton } from "./back-button";
import { InfiniteList } from "./infinite-list";
import { tagListing } from "@/lib/listing-build";
import { getTags, getCatalog, staticDataRoot } from "@/lib/static-site";
import { pageItems } from "@/lib/pagination";
export function TagIndex({ page = 1 }: { page?: number }) {
  const all = getTags();
  const rows = pageItems(all, page);
  if (!rows) notFound();
  return <><SiteHeader /><main className="py-5"><BackButton /><h1 className="text-2xl font-semibold">标签</h1>
    {rows.length ? <div className="mt-4"><InfiniteList key={page} initial={tagListing(getCatalog(), page)} source={`${staticDataRoot()}/lists/tags`} base="/tags" /></div>
      : <p className="py-6 text-sm text-muted-foreground">还没有标签。</p>}
  </main></>;
}
