import { SiteHeader } from "@/components/site-header";
import { SearchPageClient } from "@/components/search-page-client";
export const metadata = { title: "搜索", referrer: "no-referrer" as const };
export default function SearchPage() { return <><SiteHeader /><main className="py-5 pb-20"><h1 className="text-2xl font-semibold">搜索</h1><SearchPageClient /></main></>; }
