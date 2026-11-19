import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getTag, getTagContents, staticDataRoot } from "@/lib/static-site";
import { pageItems } from "@/lib/pagination";
import { SiteHeader } from "./site-header";
import { InfiniteList } from "./infinite-list";
import { feedListing } from "@/lib/listing-build";
import { BackButton } from "./back-button";

export function FeedPage({ kind, page = 1, slug }: {
  kind: "home" | "posts" | "tag"; page?: number; slug?: string;
}) {
  const tag = kind === "tag" ? getTag(slug ?? "") : null;
  if (kind === "tag" && !tag) notFound();
  const all = kind === "home" ? getCatalog().articles : kind === "posts" ? getCatalog().posts : getTagContents(slug!);
  const rows = pageItems(all, page);
  if (!rows) notFound();
  const base = kind === "home" ? "" : kind === "posts" ? "/posts" : `/tags/${slug}`;
  return <>
    <SiteHeader />
    <main className={tag ? "py-5 pb-20" : "pb-20"}>
      {tag && <><BackButton fallback="/tags" /><h1 className="text-2xl font-semibold">#{tag.name}</h1></>}
      {rows.length ? <>
        <InfiniteList key={`${base}:${page}`} initial={feedListing(getCatalog(), all, page, kind !== "tag")} source={`${staticDataRoot()}/lists${base || "/home"}`} base={base} />
        {kind === "home" && (
          <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            首页只放最新 10 篇，更多内容请看
            <Link href="/c" prefetch className="ml-1 text-foreground underline underline-offset-4 hover:text-primary">
              合集
            </Link>
            。
          </p>
        )}
      </>
        : <p className="py-20 text-center text-sm text-muted-foreground">{kind === "posts" ? "还没有帖子，敬请期待。" : "还没有文章，敬请期待。"}</p>}
    </main>
  </>;
}
