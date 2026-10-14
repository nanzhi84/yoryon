"use client";
import { useChapterContext } from "./chapter-reading";
import { chapterHref, useCollectionFlow } from "./collection-flow";
import Link from "next/link";
import type { ContentDetail } from "@/lib/types";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

/** 只导航到公开可发现的作品地址，目标正文继续由详情接口判断阅读权限。 */
export function CollectionNavigation({ collections, contentId }: { collections: ContentDetail["collections"]; contentId: string }) {
  const { context, slug, flowId, loading, error, retry } = useChapterContext(contentId);
  const holder = useCollectionFlow();
  const liveFlowId = context && holder.current?.id === flowId && holder.current.collectionId === context.collection.id ? flowId : null;
  const selected = context ? [{ ...context.collection, previous: context.previous, next: context.next }] : slug ? [] : collections;
  const href = (chapter: string, collection: string) => chapterHref(chapter, collection, liveFlowId);
  if (slug && loading) return <p role="status" className="mt-6 text-sm text-muted-foreground">正在加载章节导航…</p>;
  if (error) return <p role="alert" className="mt-6 text-sm">章节导航加载失败。<button onClick={retry} className="min-h-11 text-primary underline">重试</button></p>;
  if (!selected.length) return null;
  const cardClass = "min-h-[88px] rounded-[10px] border border-border p-3.5";
  const linkClass = `${cardClass} transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`;
  return <nav aria-label="合集上下篇导航" className="mt-7 space-y-6">
    {selected.map(collection => <section key={collection.slug} aria-label={`合集：${collection.title}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold leading-6">继续阅读</h2>
        <Link prefetch={false} href={`/c/${collection.slug}${liveFlowId ? `?flow=${liveFlowId}` : ""}`} className="inline-flex min-w-0 items-center gap-1 text-xs leading-[18px] text-primary hover:underline underline-offset-4">
          <span className="truncate">返回合集：{collection.title}</span><ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {collection.previous ? <Link prefetch={false} href={href(collection.previous.slug, collection.slug)} rel="prev" className={linkClass}>
          <span className="flex items-center gap-1 text-xs leading-[18px] text-primary"><ArrowLeft className="size-3.5" aria-hidden="true" />上一篇</span>
          <span className="mt-2 block break-words text-[15px] font-medium leading-[22px]">{collection.previous.title || collection.previous.slug}</span>
        </Link> : <div aria-disabled="true" className={`${cardClass} text-muted-foreground`}><span className="block text-xs leading-[18px]">上一篇</span><p className="mt-2 text-[13px] leading-5">已是合集第一篇</p></div>}
        {collection.next ? <Link prefetch={false} href={href(collection.next.slug, collection.slug)} rel="next" className={linkClass}>
          <span className="flex items-center gap-1 text-xs leading-[18px] text-primary">下一篇<ArrowRight className="size-3.5" aria-hidden="true" /></span>
          <span className="mt-2 block break-words text-[15px] font-medium leading-[22px]">{collection.next.title || collection.next.slug}</span>
        </Link> : <div aria-disabled="true" className={`${cardClass} text-muted-foreground`}><span className="block text-xs leading-[18px]">下一篇</span><p className="mt-2 text-[13px] leading-5">已是合集最后一篇</p></div>}
      </div>
    </section>)}
  </nav>;
}
