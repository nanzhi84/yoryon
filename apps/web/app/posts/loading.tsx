import { SiteHeader } from "@/components/site-header";

export default function LoadingPosts() {
  return <><SiteHeader /><main className="py-20 text-center text-sm text-muted-foreground"><p role="status">正在加载帖子…</p></main></>;
}
