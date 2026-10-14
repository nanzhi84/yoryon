"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ContentDetail, FeedContentItem } from "@/lib/types";
import { currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";
import { MarkdownSurface } from "./markdown-surface";

export function PostEntry({ item }: { item: FeedContentItem }) {
  const [expanded, setExpanded] = useState<ContentDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [clipped, setClipped] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const localUnfold = item.visibility === "public" && !item.post?.collapsed;
  const rememberOpen = useCallback((value: boolean) => {
    const key = `post-open:${currentBrowsePath()}`;
    const saved = readBrowse<string[]>(key) ?? [];
    writeBrowse(key, [...saved.filter(id => id !== item.id), ...(value ? [item.id] : [])].slice(-100));
  }, [item.id]);
  useLayoutEffect(() => {
    setOpen(localUnfold && (readBrowse<string[]>(`post-open:${currentBrowsePath()}`) ?? []).includes(item.id));
  }, [item.id, localUnfold]);
  const collapse = useCallback(() => { active.current?.abort(); active.current = null; setOpen(false); rememberOpen(false); setExpanded(null); setLoading(false); setError(false); }, [rememberOpen]);
  useEffect(() => {
    const refresh = () => { if (!localUnfold && document.visibilityState === "visible") collapse(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active.current?.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [collapse, item.id, localUnfold]);
  useEffect(() => {
    const measure = () => {
      if (host.current && !open) setClipped(host.current.scrollHeight > host.current.clientHeight + 1
        || (host.current.firstElementChild?.children.length ?? 0) > 6);
    };
    const observer = new ResizeObserver(measure);
    if (host.current) { observer.observe(host.current); for (const el of host.current.children) observer.observe(el); }
    measure(); return () => observer.disconnect();
  }, [open, item.post]);
  async function expand() {
    if (active.current) return;
    if (localUnfold) { rememberOpen(true); setOpen(true); return; }
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(false);
    try {
      const response = await fetch(`/api/contents/${item.slug}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (!response.ok) throw new Error("post unavailable");
      const data = await response.json() as ContentDetail;
      if (data.type !== "post" || data.id !== item.id || typeof data.bodyMarkdown !== "string" || !Array.isArray(data.media)) throw new Error("content changed");
      if (!controller.signal.aborted) { setExpanded(data); setOpen(true); }
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (active.current === controller) { active.current = null; if (!controller.signal.aborted) setLoading(false); } }
  }
  const markdown = expanded?.bodyMarkdown ?? item.post?.bodyMarkdown ?? "";
  const media = expanded?.media ?? item.post?.media ?? [];
  // Keep the parsed Markdown and media mounted while only the clipping changes.
  const body = useMemo(() => {
    const mediaSizes = Object.fromEntries(media.map(m => [m.mediaId, { width: m.width, height: m.height, mimeType: m.mimeType, durationSec: m.durationSec }]));
    return <MarkdownSurface preserveBlankLines className="prose-feed" markdown={markdown} mediaSizes={mediaSizes} publicImages={!expanded} />;
  }, [markdown, media, expanded]);
  return <div className="mt-2">
    <div ref={host} id={`post-${item.id}`} className={open ? "" : "post-preview max-h-[32rem] overflow-hidden"}>
      {body}
    </div>
    {expanded?.access === "preview" && expanded.hasPaidContent && <p className="mt-3 text-sm text-muted-foreground">以上为当前允许的付费预览，兑换订阅后可阅读全文。</p>}
    {error && <p role="alert" className="mt-2">帖子加载失败。<button className="underline" onClick={() => void expand()}>重试</button></p>}
    {(item.post?.collapsed || clipped || open) && <button type="button" disabled={loading} aria-expanded={open} aria-controls={`post-${item.id}`} className="mt-1 min-h-8 text-[13px] leading-5 text-primary hover:underline" onClick={() => open ? collapse() : void expand()}>{loading ? "加载中…" : open ? "收起" : "展开"}</button>}
  </div>;
}
