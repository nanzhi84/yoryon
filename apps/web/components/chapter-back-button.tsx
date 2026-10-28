"use client";
import { BackLink } from "./back-link";
import { BackButton } from "./back-button";
import { useChapterContext } from "./chapter-reading";
export function ChapterBackButton({ contentId }: { contentId: string }) {
  const { context } = useChapterContext(contentId);
  return context ? <BackLink href={`/c/${context.slug}`}>返回合集</BackLink> : <BackButton />;
}
