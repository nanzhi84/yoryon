import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SearchPageClient } from "@/components/search-page-client";
import { staticDataRoot } from "@/lib/static-site";
import { noIndex } from "@/lib/seo";
export const metadata = { title: "搜索", robots: noIndex };
export default function SearchPage() {
  return <><SiteHeader /><main className="py-5 pb-20"><h1 className="text-2xl font-semibold">搜索</h1>
    <Suspense fallback={<p className="mt-5">正在加载搜索…</p>}><SearchPageClient root={`${staticDataRoot()}/search`} /></Suspense>
  </main></>;
}
