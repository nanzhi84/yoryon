import { Suspense } from "react";
import Link from "next/link";
import type { StaticContent } from "@yoryon/config/static-site";
import { SiteHeader } from "./site-header";
import { formatDate } from "@/lib/date";
import { ChapterContextProvider } from "./chapter-reading";
import { ContentBody } from "./content-body";
import { CommentSection } from "./comment-section";
import { CollectionNavigation } from "./collection-navigation";
import { ChapterBackButton } from "./chapter-back-button";
import { SearchLocation } from "./search-location";
export function ContentView({ initial: content }: { initial: StaticContent }) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <ChapterContextProvider contentId={content.id} collections={content.collections}>
          <main className="editorial-reader py-5">
            <ChapterBackButton contentId={content.id} />
            <Suspense fallback={null}>
              <SearchLocation slug={content.slug} />
            </Suspense>
            <header className={content.type === "article" ? "editorial-title" : "mb-5"}>
              {content.type === "article" && (
                <h1 className="font-semibold">{content.title || "未命名内容"}</h1>
              )}
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[1.6] text-muted-foreground ${content.type === "article" ? "mt-5 justify-center" : ""}`}
              >
                <time dateTime={content.publishedAt ?? undefined}>
                  {formatDate(content.publishedAt)}
                </time>
              </div>
              {(content.tags.length > 0 || content.collections.length > 0) && (
                <div
                  className={`mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-[18px] text-muted-foreground ${content.type === "article" ? "justify-center" : ""}`}
                >
                  {content.tags.map((t) => (
                    <Link
                      prefetch={false}
                      key={t.slug}
                      href={`/tags/${t.slug}`}
                      className="hover:text-foreground"
                    >
                      #{t.name}
                    </Link>
                  ))}
                  {content.collections.map((c) => (
                    <Link
                      prefetch={false}
                      key={c.slug}
                      href={`/c/${c.slug}`}
                      className="hover:text-foreground"
                    >
                      合集：{c.title}
                    </Link>
                  ))}
                </div>
              )}
            </header>
            <ContentBody content={content} />
            <CollectionNavigation contentId={content.id} collections={content.collections} />
            <CommentSection comments={content.comments} />
          </main>
        </ChapterContextProvider>
      </Suspense>
    </>
  );
}
