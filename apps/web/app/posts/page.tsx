import { FeedPage } from "@/components/feed-page";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/posts", "帖子", "Yoryon 的帖子与随笔。");
export default function PostsPage() { return <FeedPage kind="posts" />; }
