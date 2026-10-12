import Link from "next/link";
import type { ContentDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { formatDate, TYPE_LABEL } from "@/components/feed-timeline";
import { DetailTracker } from "@/components/analytics";
import { ContentBody } from "./content-body";
import { PrivateReader } from "./private-reader";
import { CommentSection } from "./comment-section";
import { CollectionNavigation } from "./collection-navigation";

export function ContentView({ initial: content }: { initial: ContentDetail }) {
  return (
    <>
      <SiteHeader />
      {/* 正文与页头同栏（布局容器 max-w-3xl），不再收窄 */}
      <main className="py-8" data-revision={content.updatedAt}>
        <DetailTracker targetKind="work" targetId={content.id} />
        <header>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{TYPE_LABEL[content.type]}</span>
            <span>·</span>
            <time>{formatDate(content.publishedAt)}</time>
            {content.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{content.title}</h1>
          {content.description && <p className="mt-3 text-muted-foreground">{content.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
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

        {/* 评论区仅文章类型展示；客户端加载，不进入公开缓存页面（Issue #14） */}
        {content.type === "article" && <CommentSection slug={content.slug} />}
      </main>
    </>
  );
}
