import { FeedPage } from "@/components/feed-page";
import { getCatalog } from "@/lib/static-site";
import { additionalPages, pageNumber, pagePath } from "@/lib/pagination";
import { pageMetadata } from "@/lib/seo";
type Props = { params: Promise<{ number: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return [{ number: "1" }, ...additionalPages(getCatalog().posts.length)]; }
export async function generateMetadata({ params }: Props) {
  const page = pageNumber((await params).number);
  return pageMetadata(pagePath("/posts", page), `帖子 · 第 ${page} 页`, "Yoryon 的文章与随笔。");
}
export default async function Page({ params }: Props) { return <FeedPage kind="posts" page={pageNumber((await params).number)} />; }
