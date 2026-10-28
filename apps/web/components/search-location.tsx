"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./ui/button";
interface Hit {
  first: Text;
  last: Text;
  start: number;
  end: number;
}
export function SearchLocation({ slug }: { slug: string }) {
  const query = (useSearchParams().get("q") ?? "").trim().slice(0, 120);
  const [hits, setHits] = useState<Hit[]>([]);
  const [index, setIndex] = useState(0);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (!query) {
      setHits([]);
      return;
    }
    const body = document.querySelector(`[data-search-content="${slug}"] [data-search-body]`);
    if (!body) return;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const found: Hit[] = [];
    const q = query.toLocaleLowerCase();
    const segments: { node: Text; start: number; end: number }[] = [];
    let text = "";
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      segments.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    }
    const normalized = text.toLocaleLowerCase();
    for (let from = 0; found.length < 500;) {
      const start = normalized.indexOf(q, from);
      if (start < 0) break;
      const end = start + query.length;
      const first = segments.find((s) => s.end > start);
      const last = segments.find((s) => s.end >= end);
      if (first && last)
        found.push({
          first: first.node,
          last: last.node,
          start: start - first.start,
          end: end - last.start,
        });
      from = start + Math.max(1, query.length);
    }
    setHits(found);
    setIndex(0);
  }, [slug, query]);
  useEffect(() => {
    const hit = hits[index];
    if (!hit) return;
    const range = document.createRange();
    range.setStart(hit.first, hit.start);
    range.setEnd(hit.last, hit.end);
    const registry = (CSS as typeof CSS & { highlights?: Map<string, unknown> }).highlights;
    const HighlightClass = (
      window as typeof window & { Highlight?: new (...ranges: Range[]) => unknown }
    ).Highlight;
    if (registry && HighlightClass) registry.set("search-hit", new HighlightClass(range));
    else setFallback(true);
    hit.first.parentElement?.scrollIntoView({ block: "center" });
    return () => {
      registry?.delete("search-hit");
    };
  }, [hits, index]);
  if (!query) return null;
  return (
    <aside
      className="sticky top-2 z-20 my-4 rounded-md border border-border bg-background p-3 text-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {hits.length
            ? `正文命中 ${index + 1} / ${hits.length}${hits.length === 500 ? "+" : ""}`
            : "当前正文没有匹配文字"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hits.length || index === 0}
          onClick={() => setIndex((n) => n - 1)}
        >
          上一处
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hits.length || index >= hits.length - 1}
          onClick={() => setIndex((n) => n + 1)}
        >
          下一处
        </Button>
        {fallback && (
          <span className="text-xs text-muted-foreground">已定位；当前浏览器不支持文字高亮。</span>
        )}
      </div>
    </aside>
  );
}
