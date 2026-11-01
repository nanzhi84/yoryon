"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { pageCount, pagePath } from "@/lib/pagination";
import type { Listing } from "@/lib/listing";
import { cacheListing, loadListing } from "@/lib/listing-client";
import { BROWSE_LAYOUT_READY, readBrowse, writeBrowse } from "@/lib/browse-memory";
import { ListingSegment } from "./listing-segment";
import { LoadMore } from "./load-more";
type Memory = { end: number; width: number; heights: Record<number, number> };
export function InfiniteList({ initial, source, base, lastId }: {
  initial: Listing; source: string; base: string; lastId?: string | undefined;
}) {
  const first = initial.page, pages = pageCount(initial.total);
  const memoryKey = `list:${source}:${first}`;
  const [end, setEnd] = useState(first);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Listing | null>(null);
  const heights = useRef<Record<number, number>>({});
  const position = useRef(first);
  const lifecycle = useRef<AbortController | null>(null);
  const pending = useRef<{ page: number; promise: Promise<Listing> } | null>(null);
  const appending = useRef(false);
  const initialized = useRef(false);
  const persist = useCallback(() => writeBrowse(memoryKey, { end: position.current, width: innerWidth, heights: heights.current }), [memoryKey]);
  const onHeight = useCallback((page: number, height: number) => {
    heights.current[page] = height; if (initialized.current) persist();
  }, [persist]);
  useLayoutEffect(() => {
    lifecycle.current = new AbortController();
    cacheListing(`${source}/${first}.json`, initial);
    const memory = readBrowse<Memory>(memoryKey);
    if (memory && Number.isSafeInteger(memory.end) && memory.end >= first && memory.end <= pages) {
      position.current = memory.end;
      if (Math.abs(memory.width - innerWidth) < 1 && memory.heights && typeof memory.heights === "object")
        heights.current = Object.fromEntries(Object.entries(memory.heights).filter(([key, h]) => Number(key) >= first && Number(key) <= memory.end && Number.isFinite(h) && h > 0));
      setEnd(memory.end);
    }
    initialized.current = true; setReady(true);
    return () => { initialized.current = false; lifecycle.current?.abort(); pending.current = null; };
  }, [first, initial, memoryKey, pages, source]);
  useEffect(() => {
    if (ready) window.dispatchEvent(new Event(BROWSE_LAYOUT_READY));
  }, [ready, end]);
  const next = useCallback((reload = false) => {
    const page = position.current + 1;
    if (pending.current?.page === page && !reload) return pending.current.promise;
    const signal = lifecycle.current!.signal;
    const promise = loadListing(`${source}/${page}.json`, initial, page, signal, reload);
    pending.current = { page, promise };
    return promise;
  }, [source, initial]);
  const prefetch = useCallback(() => {
    if (!lifecycle.current || lifecycle.current.signal.aborted || position.current >= pages) return;
    void next().catch(error => {
      if (!lifecycle.current?.signal.aborted) setError(error instanceof Error ? error.message : "后续内容加载失败。");
    });
  }, [next, pages]);
  const append = useCallback((reload: boolean) => {
    if (appending.current || !lifecycle.current || position.current >= pages) return;
    appending.current = true; setLoading(true); setError(null);
    void next(reload).then(chunk => {
      if (lifecycle.current?.signal.aborted) return;
      position.current = chunk.page; pending.current = null;
      setFresh(chunk); setEnd(chunk.page); persist();
    }).catch(error => {
      if (!lifecycle.current?.signal.aborted) setError(error instanceof Error ? error.message : "后续内容加载失败。");
    }).finally(() => {
      appending.current = false;
      if (!lifecycle.current?.signal.aborted) setLoading(false);
    });
  }, [next, pages, persist]);
  return <div data-browse-ready={ready ? "true" : "false"}>
    {first > 1 && <a href={pagePath(base, 1)} className="my-3 inline-flex min-h-11 items-center text-sm text-primary underline">从头浏览</a>}
    <div className="divide-y divide-border">
      {Array.from({ length: end - first + 1 }, (_, index) => first + index).map(page => <ListingSegment key={page}
        url={`${source}/${page}.json`} page={page} expected={initial}
        initial={page === first ? initial : fresh?.page === page ? fresh : undefined}
        height={heights.current[page] ?? (initial.kind === "feed" ? 2200 : 650)} onHeight={onHeight} lastId={lastId} />)}
    </div>
    <LoadMore more={ready && end < pages} loading={loading} error={error} onLoad={append} onPrefetch={prefetch} fallback={pagePath(base, end + 1)} />
    {!ready && end < pages && <noscript><a href={pagePath(base, end + 1)}>继续阅读</a></noscript>}
  </div>;
}
