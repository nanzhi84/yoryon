"use client";
import { useChapterContext } from "./chapter-reading";
import { chapterHref } from "@/lib/collection-links";
import Link from "next/link";
import type { ContentDetail } from "@/lib/types";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

/** 章节关系在导出时校验，浏览器只在公开快照中的已发布章节间导航。 */
export function CollectionNavigation({
  collections,
  contentId,
}: {
  collections: ContentDetail["collections"];
  contentId: string;
}) {
  const { context, slug } = useChapterContext(contentId);
  const selected = context ? [context] : slug ? [] : collections;
  const href = chapterHref;
  if (!selected.length) return null;
  const cardClass = "min-h-[88px] rounded-[10px] border border-border p-3.5";
  const linkClass = `${cardClass} transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`;
  return (
    <nav aria-label="合集上下篇导航" className="mt-7 space-y-6">
      {selected.map((collection) => (
        <section key={collection.slug} aria-label={`合集：${collection.title}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold leading-6">继续阅读</h2>
            <Link
              prefetch={false}
              href={`/c/${collection.slug}`}
              className="inline-flex min-w-0 items-center gap-1 text-xs leading-[18px] text-primary hover:underline underline-offset-4"
            >
              <span className="truncate">返回合集：{collection.title}</span>
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {collection.previous ? (
              <Link
                prefetch={false}
                href={href(collection.previous.slug, collection.slug)}
                rel="prev"
                className={linkClass}
              >
                <span className="flex items-center gap-1 text-xs leading-[18px] text-primary">
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  上一篇
                </span>
                <span className="mt-2 block break-words text-[15px] font-medium leading-[22px]">
                  {collection.previous.title || collection.previous.slug}
                </span>
              </Link>
            ) : (
              <div aria-disabled="true" className={`${cardClass} text-muted-foreground`}>
                <span className="block text-xs leading-[18px]">上一篇</span>
                <p className="mt-2 text-[13px] leading-5">已是合集第一篇</p>
              </div>
            )}
            {collection.next ? (
              <Link
                prefetch={false}
                href={href(collection.next.slug, collection.slug)}
                rel="next"
                className={linkClass}
              >
                <span className="flex items-center gap-1 text-xs leading-[18px] text-primary">
                  下一篇
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-2 block break-words text-[15px] font-medium leading-[22px]">
                  {collection.next.title || collection.next.slug}
                </span>
              </Link>
            ) : (
              <div aria-disabled="true" className={`${cardClass} text-muted-foreground`}>
                <span className="block text-xs leading-[18px]">下一篇</span>
                <p className="mt-2 text-[13px] leading-5">已是合集最后一篇</p>
              </div>
            )}
          </div>
        </section>
      ))}
    </nav>
  );
}
