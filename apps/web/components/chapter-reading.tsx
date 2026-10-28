"use client";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { StaticContent } from "@yoryon/config/static-site";
import { rememberCollectionChapter } from "@/lib/collection-memory";
type Entry = StaticContent["collections"][number];
const Context = createContext<{
  contentId: string;
  context: Entry | null;
  slug: string | null;
} | null>(null);
function ChapterQuery({ onChange }: { onChange: (slug: string | null) => void }) {
  const slug = useSearchParams().get("collection");
  useEffect(() => onChange(slug), [slug, onChange]);
  return null;
}
export function ChapterContextProvider({
  contentId,
  collections,
  children,
}: {
  contentId: string;
  collections: Entry[];
  children: ReactNode;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const context = collections.find((c) => c.slug === slug) ?? null;
  return (
    <Context.Provider value={{ contentId, context, slug }}>
      <Suspense fallback={null}>
        <ChapterQuery onChange={setSlug} />
      </Suspense>
      {children}
    </Context.Provider>
  );
}
export function useChapterContext(contentId: string) {
  const state = useContext(Context);
  if (!state || state.contentId !== contentId)
    throw new Error("Chapter context does not match content");
  return state;
}
export function ChapterReading({ contentId }: { contentId: string }) {
  const { context } = useChapterContext(contentId);
  useEffect(() => {
    if (context) rememberCollectionChapter(context.id, contentId);
  }, [context, contentId]);
  return null;
}
