import { notFound } from "next/navigation";
import { getCatalog, getTag, getTagContents, toFeed } from "@/lib/static-site";
import { pageItems } from "@/lib/pagination";
import { SiteHeader } from "./site-header";
import { FeedTimeline } from "./feed-timeline";
import { BackButton } from "./back-button";
import { Pagination } from "./pagination";

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
      {rows.length ? <div className="divide-y divide-border"><FeedTimeline items={rows.map(toFeed)} showPinnedBadge={kind !== "tag"} /></div>
        : <p className="py-20 text-center text-sm text-muted-foreground">{kind === "posts" ? "还没有帖子，敬请期待。" : "还没有文章，敬请期待。"}</p>}
      <Pagination base={base} page={page} total={all.length} />
    </main>
  </>;
}
