import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return <><SiteHeader /><main className="py-8" aria-busy="true"><p role="status" className="text-sm text-muted-foreground">正在加载合集…</p><div className="mt-5 h-32 animate-pulse rounded-md bg-muted" /></main></>;
}
