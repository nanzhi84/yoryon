import { TagIndex } from "@/components/tag-index";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/tags", "标签", "按标签浏览 Yoryon 的文章与帖子。");
export default function ExplorePage() { return <TagIndex />; }
