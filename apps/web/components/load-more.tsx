"use client";
import { useEffect, useRef, useState } from "react";
import { ListLoading } from "./list-loading";
export function LoadMore({ more, loading, error, onLoad, onPrefetch, fallback }: {
  more: boolean; loading: boolean; error: string | null;
  onLoad: (retry: boolean) => void; onPrefetch?: (() => void) | undefined; fallback?: string | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!more || error || !host.current) return;
    if (!("IntersectionObserver" in window)) { setManual(true); return; }
    const load = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !loading) onLoad(false);
    }, { rootMargin: "400px 0px" });
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const prefetch = onPrefetch && !connection?.saveData ? new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) onPrefetch();
    }, { rootMargin: "1200px 0px" }) : null;
    load.observe(host.current); prefetch?.observe(host.current);
    return () => { load.disconnect(); prefetch?.disconnect(); };
  }, [more, loading, error, onLoad, onPrefetch]);
  if (!more) return null;
  return <div ref={host} className="flex min-h-16 items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
    {loading && <ListLoading />}
    {error ? <><span role="alert">{error}</span><button type="button" className="min-h-11 text-primary underline" onClick={() => onLoad(true)}>重试</button>
      {fallback && <a href={fallback} className="text-primary underline">直接打开</a>}</>
      : manual && !loading && <button type="button" className="min-h-11 text-primary underline" onClick={() => onLoad(false)}>加载更多</button>}
    {fallback && <noscript><a href={fallback}>继续阅读</a></noscript>}
  </div>;
}
