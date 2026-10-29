"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "./ui/skeleton";
import { useReaderHint } from "./reader-navigation";
import { formatDate } from "@/lib/date";

// Static snapshots have no dynamic body geometry; keep the existing paragraph fallback.
const paragraphLengths = [100, 150, 80];
function Bar({ width = "100%", height = 17 }: { width?: string; height?: number }) {
  return <Skeleton className="reader-skeleton animate-none" style={{ width, height }} />;
}
function Lines({ lengths, width, font = 17 }: { lengths: number[]; width: number; font?: number }) {
  const capacity = Math.max(10, width / font);
  return <div style={{ display: "grid", gap: font * 0.85 }}>
    {lengths.flatMap((length, index) => {
      const count = Math.min(8, Math.max(1, Math.ceil(length / capacity)));
      return Array.from({ length: count }, (_, line) => <Bar key={`${index}-${line}`} height={font}
        width={line < count - 1 ? "100%" : `${Math.max(8, Math.min(100, ((length - (count - 1) * capacity) / capacity) * 100))}%`} />);
    })}
  </div>;
}
export function ReaderSkeleton() {
  const hint = useReaderHint();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(612);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} aria-hidden="true">
    <div className="editorial-title">
      {hint?.title ? <h1>{hint.title}</h1> : <div className="mx-auto w-3/5"><Bar height={36} /></div>}
      {hint?.publishedAt ? <time className="mt-5 block text-xs text-muted-foreground">{formatDate(hint.publishedAt)}</time> :
        <div className="mx-auto mt-5 w-24"><Bar height={12} /></div>}
    </div>
    {paragraphLengths.map((length, index) => (
      <div key={index} data-skeleton-block="paragraph" style={{ marginBottom: 20 }}>
        <Lines lengths={[length]} width={width} />
      </div>
    ))}
  </div>;
}
