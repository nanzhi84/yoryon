"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rememberCollectionChapter } from "@/lib/collection-memory";
import { useCollectionFlow, useCollectionTime } from "./collection-flow";

export interface ChapterContext {
  collection: { id: string; slug: string; title: string };
  chapter: { id: string; slug: string; title: string };
  previous: { id: string; slug: string; title: string } | null;
  next: { id: string; slug: string; title: string } | null;
}

/** URL context supplies a candidate only; the API validates current published membership. */
export function useChapterContext(contentId: string) {
  const params = useSearchParams();
  const slug = params.get("collection");
  const flowId = params.get("flow");
  const [context, setContext] = useState<ChapterContext | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(slug));
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") { setContext(null); retry(n => n + 1); }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);
  useEffect(() => {
    setContext(null); setError(false); setLoading(Boolean(slug));
    if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) { setLoading(false); return; }
    const controller = new AbortController();
    void fetch(`/api/collections/${slug}/chapters/${contentId}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("chapter context unavailable");
        return await response.json() as ChapterContext;
      })
      .then(data => {
        if (controller.signal.aborted || !data) return;
        if (data.chapter.id !== contentId || data.collection.slug !== slug) throw new Error("invalid chapter context");
        setContext(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, contentId, attempt]);
  // Effects can commit after a new URL has rendered; never expose that previous context.
  return { context: context?.collection.slug === slug && context.chapter.id === contentId ? context : null, flowId, slug, loading, error, retry: () => retry(n => n + 1) };
}

/** Mounted inside the actual authorized body, including dynamically rendered member bodies. */
export function ChapterReading({ contentId }: { contentId: string }) {
  const { context, flowId } = useChapterContext(contentId);
  const holder = useCollectionFlow();
  const flow = holder.current;
  const validFlowId = context && flow?.id === flowId && flow.collectionId === context.collection.id ? flow.id : null;
  useCollectionTime(validFlowId, Boolean(context));
  useEffect(() => {
    if (!context) return;
    if (document.visibilityState === "visible") rememberCollectionChapter(context.collection.id, contentId);
  }, [context, contentId]);
  return null;
}
