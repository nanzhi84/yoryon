import { SiteHeader } from "@/components/site-header";
import { BackButton } from "@/components/back-button";
import { ReaderSkeleton } from "@/components/reader-skeleton";

export default function Loading() {
  return <>
    <SiteHeader />
    <main className="editorial-reader py-5" aria-busy="true" aria-label="文章加载中">
      <BackButton />
      <div role="status" className="sr-only">正在加载文章</div>
      <ReaderSkeleton />
    </main>
  </>;
}
