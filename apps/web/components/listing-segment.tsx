"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/listing";
import { cachedListing, loadListing } from "@/lib/listing-client";
import { ListingItems } from "./listing-items";
import { ListLoading } from "./list-loading";
export function ListingSegment({ url, page, expected, initial, height, onHeight, lastId }: {
  url: string; page: number; expected: Listing; initial?: Listing | undefined;
  height: number; onHeight: (page: number, height: number) => void; lastId?: string | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const measured = useRef(height);
  const [near, setNear] = useState(!!initial);
  const [data, setData] = useState<Listing | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element || !("IntersectionObserver" in window)) { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      // Keep the keyboard's active controls mounted even when scrolled out of view.
      if (visible || !element.contains(document.activeElement)) setNear(visible);
    }, { rootMargin: "1600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!host.current || !data) return;
    const element = host.current;
    const measure = () => {
      const value = element.getBoundingClientRect().height;
      if (value > 0 && Math.abs(value - measured.current) > .5) {
        measured.current = value; onHeight(page, value);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, page, onHeight]);
  useEffect(() => {
    if (!near) { if (measured.current > 0) setData(null); return; }
    const known = retry ? undefined : cachedListing(url) ?? initial;
    if (known) { setData(known); setError(null); return; }
    const controller = new AbortController();
    setError(null);
    void loadListing(url, expected, page, controller.signal, retry > 0).then(chunk => {
      if (!controller.signal.aborted) setData(chunk);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "内容加载失败。");
    });
    return () => controller.abort();
  }, [near, url, page, expected, initial, retry]);
  return <div ref={host} data-list-block={page} style={data ? undefined : { minHeight: measured.current || height }}>
    {data ? <ListingItems chunk={data} lastId={lastId} /> : near && <div className="flex min-h-16 items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
      {error ? <><span role="alert">{error}</span><button type="button" className="min-h-11 underline" onClick={() => setRetry(n => n + 1)}>重试</button></> : <ListLoading />}
    </div>}
  </div>;
}
