"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useChapterContext } from "./chapter-reading";
import { BackButton } from "./back-button";

export function ChapterBackButton({ contentId }: { contentId: string }) {
  const { context, flowId, slug, loading, error, retry } = useChapterContext(contentId);
  const className = "mb-2 inline-flex min-h-11 items-center gap-2 rounded-sm text-[13px] leading-5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  if (context) {
    const query = flowId ? `?${new URLSearchParams({ flow: flowId })}` : "";
    return <Link prefetch={false} href={`/c/${context.collection.slug}${query}`} className={className}>
      <ArrowLeft className="size-4" aria-hidden="true" />返回合集
    </Link>;
  }
  if (slug && loading) return <button disabled className={className} aria-label="正在加载返回合集链接"><ArrowLeft className="size-4" aria-hidden="true" />返回合集</button>;
  if (slug && error) return <button onClick={retry} className={className}>合集加载失败，重试</button>;
  return <BackButton />;
}
