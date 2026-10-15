"use client";

import { BackLink, backControlClassName } from "./back-link";
import { ArrowLeft } from "lucide-react";
import { useChapterContext } from "./chapter-reading";
import { BackButton } from "./back-button";

export function ChapterBackButton({ contentId }: { contentId: string }) {
  const { context, flowId, slug, loading, error, retry } = useChapterContext(contentId);
  const className = backControlClassName;
  if (context) {
    const query = flowId ? `?${new URLSearchParams({ flow: flowId })}` : "";
    return <BackLink href={`/c/${context.collection.slug}${query}`}>返回合集</BackLink>;
  }
  if (slug && loading) return <button disabled className={className} aria-label="正在加载返回合集链接"><ArrowLeft className="size-4" aria-hidden="true" />返回合集</button>;
  if (slug && error) return <button onClick={retry} className={className}>合集加载失败，重试</button>;
  return <BackButton />;
}
