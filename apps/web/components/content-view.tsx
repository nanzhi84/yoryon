import { SearchLocation } from "./search-location";
import Link from "next/link";
import type { ContentDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { formatDate } from "@/components/feed-timeline";
import { DetailTracker } from "@/components/analytics";
import { ContentBody } from "./content-body";
import { PrivateReader } from "./private-reader";
import { CommentSection } from "./comment-section";
import { CollectionNavigation } from "./collection-navigation";
import { BackButton } from "./back-button";

export function ContentView({ initial: content }: { initial: ContentDetail }) {
  return (
    <>
      <SiteHeader />
      {/* 正文与页头同栏（布局容器 max-w-3xl），不再收窄 */}
      <main className="py-5" data-revision={content.updatedAt}>
        <BackButton />
        <DetailTracker targetKind="work" targetId={content.id} />
        <SearchLocation slug={content.slug} />
        <header>
          <div className="flex items-center gap-2 text-xs leading-[18px] text-muted-foreground">
            <time>{formatDate(content.publishedAt)}</time>
            {content.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-[38px]">{content.title || "未命名内容"}</h1>
          {content.description && <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{content.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-[18px] text-muted-foreground">
            {content.tags.map((t) => (
              <Link prefetch={false} key={t.slug} href={`/tags/${t.slug}`} className="hover:text-foreground">
                #{t.name}
              </Link>
            ))}
            {content.collections.map((c) => (
              <Link prefetch={false} key={c.slug} href={`/c/${c.slug}`} className="hover:text-foreground">
                合集：{c.title}
              </Link>
            ))}
          </div>
        </header>

        {content.visibility === "paid" ? <PrivateReader initial={content} preview={<ContentBody content={content} publicImages />} /> : <ContentBody content={content} publicImages />}

        <CollectionNavigation collections={content.collections} />

        {/* post/article 共用互动；客户端加载，不进入公开缓存页面。 */}
        <CommentSection slug={content.slug} />
      </main>
    </>
  );
}
