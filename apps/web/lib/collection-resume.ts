"use client";
import { useEffect, useState } from "react";
import { collectionPositionKey, readCollectionPosition } from "./collection-memory";
export interface ChapterItem {
  id: string; slug: string; title: string; publishedAt: string | null; position: number;
}
export function useCollectionResume(id: string, lookup: string, items: ChapterItem[], first: ChapterItem | null, total: number) {
  const [last, setLast] = useState<ChapterItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active: AbortController | undefined;
    let generation = 0;
    let reload = retry > 0;
    const restore = async () => {
      active?.abort();
      const sequence = ++generation;
      const position = readCollectionPosition(id);
      setFailed(false);
      if (!position) { setLast(null); return; }
      const known = items.find(item => item.id === position.chapterId) ?? (first?.id === position.chapterId ? first : null);
      if (known) { setLast(known); return; }
      setLast(null);
      active = new AbortController();
      const cache = reload ? "reload" : "force-cache";
      reload = false;
      try {
        const response = await fetch(`${lookup}/${position.chapterId}.json`, {
          signal: AbortSignal.any([active.signal, AbortSignal.timeout(15_000)]), cache,
        });
        if (sequence !== generation) return;
        if (response.status === 404) {
          if (readCollectionPosition(id)?.chapterId === position.chapterId) {
            try { localStorage.removeItem(collectionPositionKey(id)); } catch { /* Optional storage. */ }
          }
          return;
        }
        if (!response.ok) throw new Error("resume unavailable");
        const row: unknown = await response.json();
        if (!row || typeof row !== "object") throw new Error("invalid chapter");
        const c = row as ChapterItem;
        if (c.id !== position.chapterId || typeof c.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(c.slug) ||
          typeof c.title !== "string" || !Number.isSafeInteger(c.position) || c.position < 1 || c.position > total) throw new Error("invalid chapter");
        if (sequence === generation) setLast(c);
      } catch {
        if (sequence === generation && !active?.signal.aborted) setFailed(true);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === collectionPositionKey(id)) void restore();
    };
    void restore();
    window.addEventListener("focus", restore);
    window.addEventListener("storage", storage);
    return () => {
      generation++; active?.abort();
      window.removeEventListener("focus", restore);
      window.removeEventListener("storage", storage);
    };
  }, [id, lookup, items, first, total, retry]);
  return { last, failed, retry: () => setRetry(n => n + 1) };
}
