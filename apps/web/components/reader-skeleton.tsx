"use client";

import { useEffect, useRef, useState } from "react";
import type { ReaderLayout } from "@yoryon/config/reader-layout";
import { Skeleton } from "./ui/skeleton";
import { useReaderHint } from "./reader-navigation";
import { formatDate } from "@/lib/date";

const fallback: ReaderLayout = [
  { kind: "paragraph", lengths: [100] }, { kind: "paragraph", lengths: [150] },
  { kind: "paragraph", lengths: [80] },
];
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
    {(hint?.layout.length ? hint.layout : fallback).map((block, index) => {
      const lines = <Lines lengths={block.lengths} width={width - (["quote", "list", "code"].includes(block.kind) ? 36 : 0)} />;
      return <div key={index} data-skeleton-block={block.kind} style={{ marginBottom: 20 }}>
        {block.kind === "media" ? <Bar height={Math.min(360, width * 0.6)} /> :
          block.kind === "rule" ? <div className="my-10 border-t border-border" /> :
          block.kind === "heading" ? <div style={{ marginTop: block.level === 2 ? 52 : 36, marginBottom: 18 }}><Lines lengths={block.lengths} width={width} font={block.level === 2 ? 23 : 19} /></div> :
          block.kind === "list" ? <div className="space-y-3 pl-5">{block.lengths.map((length, i) => <div key={i} className="flex gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-muted" /><div className="flex-1"><Lines lengths={[length]} width={width - 36} /></div></div>)}</div> :
          block.kind === "code" ? <div className="rounded-md bg-muted/40 px-[18px] py-4"><Lines lengths={block.lengths} width={width - 36} font={13} /></div> :
          block.kind === "quote" ? <div className="border-l-2 border-border pl-4">{lines}</div> :
          block.kind === "summary" ? <section className="editorial-keypoints"><div className="mb-4 w-16"><Bar height={12} /></div>{lines}</section> : lines}
      </div>;
    })}
  </div>;
}
