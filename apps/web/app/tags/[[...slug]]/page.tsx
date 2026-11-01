import { notFound } from "next/navigation";
import { TagIndex } from "@/components/tag-index";
import { FeedPage } from "@/components/feed-page";
import { getTag } from "@/lib/static-site";
import { tagPaths } from "@/lib/tag-routes";
import { pageNumber, pagePath } from "@/lib/pagination";
import { pageMetadata } from "@/lib/seo";
type Props = { params: Promise<{ slug?: string[] }> };
export const dynamicParams = false;
export function generateStaticParams() { return tagPaths().map(p => ({ slug: p.split("/").slice(2) })); }
function resolve(parts: string[]) {
  if (!parts.length) return { tag: null, page: 1 };
  if (parts.length === 2 && parts[0] === "page") return { tag: null, page: pageNumber(parts[1]!) };
  const tag = getTag(parts[0]!);
  if (!tag) return null;
  const page = parts.length === 1 ? 1 : parts.length === 3 && parts[1] === "page" ? pageNumber(parts[2]!) : 0;
  return page ? { tag, page } : null;
}
export async function generateMetadata({ params }: Props) {
  const route = resolve((await params).slug ?? []);
  if (!route) return { title: "标签不存在" };
  const base = route.tag ? `/tags/${route.tag.slug}` : "/tags";
  return pageMetadata(pagePath(base, route.page), route.tag ? `#${route.tag.name}` : "标签", "按标签浏览 Yoryon 的文章与帖子。");
}
export default async function Page({ params }: Props) {
  const route = resolve((await params).slug ?? []);
  if (!route) notFound();
  return route.tag ? <FeedPage kind="tag" slug={route.tag.slug} page={route.page} /> : <TagIndex page={route.page} />;
}
