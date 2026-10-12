"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentDetail, FeedContentItem } from "@/lib/types";
import { MarkdownSurface } from "./markdown-surface";
import { TrackClickLink } from "./analytics";

export function PostEntry({ item }: { item: FeedContentItem }) {
  const [expanded, setExpanded] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [clipped, setClipped] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const collapse = useCallback(() => { active.current?.abort(); setExpanded(null); setLoading(false); setError(false); }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") collapse(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active.current?.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [collapse, item.id]);
  useEffect(() => {
    const measure = () => { if (host.current && !expanded) setClipped(host.current.scrollHeight > host.current.clientHeight + 1); };
    const observer = new ResizeObserver(measure);
    if (host.current) { observer.observe(host.current); for (const el of host.current.children) observer.observe(el); }
    measure(); return () => observer.disconnect();
  }, [expanded, item.post]);
  async function expand() {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(false);
    try {
      const response = await fetch(`/api/contents/${item.slug}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (!response.ok) throw new Error("post unavailable");
      const data = await response.json() as ContentDetail;
      if (data.type !== "post") throw new Error("content type changed");
      if (!controller.signal.aborted) setExpanded(data);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const markdown = expanded?.bodyMarkdown ?? item.post?.bodyMarkdown ?? "";
  const media = expanded?.media ?? item.post?.media ?? [];
  const mediaSizes = Object.fromEntries(media.filter(m => m.width && m.height).map(m => [m.mediaId, { width: m.width!, height: m.height!, mimeType: m.mimeType }]));
  return <div className="mt-3">
    <div ref={host} id={`post-${item.id}`} className={expanded ? "" : "max-h-[32rem] overflow-hidden"}>
      <MarkdownSurface key={expanded ? "expanded" : "folded"} markdown={markdown} mediaSizes={mediaSizes} publicImages={!expanded} />
    </div>
    {expanded?.access === "preview" && expanded.hasPaidContent && <p className="mt-3 text-sm text-muted-foreground">以上为当前允许的付费预览，兑换订阅后可阅读全文。</p>}
    {error && <p role="alert" className="mt-2">帖子加载失败。<button className="underline" onClick={() => void expand()}>重试</button></p>}
    <div className="mt-3 flex items-center gap-4 text-sm">
      {(item.post?.collapsed || clipped || expanded) && <button type="button" disabled={loading} aria-expanded={!!expanded} aria-controls={`post-${item.id}`} className="underline" onClick={() => expanded ? collapse() : void expand()}>{loading ? "加载中…" : expanded ? "收起" : "展开"}</button>}
      <TrackClickLink targetKind="work" targetId={item.id} href={`/p/${item.slug}#comments`} className="text-muted-foreground underline">详情与评论</TrackClickLink>
    </div>
  </div>;
}
