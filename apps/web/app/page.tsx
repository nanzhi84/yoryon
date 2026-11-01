import { FeedPage } from "@/components/feed-page";
import { pageMetadata, siteDescription } from "@/lib/seo";
export const metadata = { ...pageMetadata("/", "Yoryon", siteDescription), title: { absolute: "Yoryon" } };
export default function HomePage() { return <FeedPage kind="home" />; }
