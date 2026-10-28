"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";
import { InlineMedia } from "./inline-media";
import { MarkdownImage } from "./markdown-image";

interface Reference {
  available: true;
  slug: string;
  type: "post" | "article";
  title: string;
  summary: string;
  description: string;
  coverMediaId: string | null;
  visibility: string;
  media: { mediaId: string; mimeType: string; width: number | null; height: number | null } | null;
}
export function WorkReference({ id }: { id: string }) {
  const [card, setCard] = useState<Reference | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const host = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setCard(null);
    setState("loading");
    try {
      const response = await fetch(`/data/references/${id}.json`, {
        cache: "force-cache",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (response.status === 404) {
        if (!controller.signal.aborted) setState("unavailable");
        return;
      }
      if (!response.ok) throw new Error("reference unavailable");
      const data = (await response.json()) as Reference;
      if (!controller.signal.aborted) {
        setCard(data);
        setState("ready");
      }
    } catch {
      if (!controller.signal.aborted) setState("error");
    }
  }, [id]);
  useEffect(() => {
    let visible = false;
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) void load();
    });
    if (host.current) observer.observe(host.current);
    const refresh = () => {
      if (visible && document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observer.disconnect();
      active.current?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  return (
    <div ref={host} className="not-prose my-4 rounded-lg border p-4" aria-live="polite">
      {state === "loading" && <p className="text-sm text-muted-foreground">正在加载引用作品…</p>}
      {state === "unavailable" && <p className="text-sm text-muted-foreground">引用作品已不可用</p>}
      {state === "error" && (
        <p role="alert">
          引用加载失败。
          <button onClick={() => void load()} className="underline">
            重试
          </button>
        </p>
      )}
      {card && (
        <Link
          prefetch={false}
          href={`/p/${card.slug}`}
          className="block"
          aria-label={`查看引用${card.type === "article" ? "长文" : "帖子"}：${card.title || card.summary || "无标题帖子"}`}
        >
          <span className="text-xs text-muted-foreground">
            引用{card.type === "article" ? "长文" : "帖子"}
            {card.visibility === "paid" ? " · 预览" : ""}
          </span>
          {card.title && <p className="mt-1 font-medium">{card.title}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {card.summary || card.description || "查看作品"}
          </p>
        </Link>
      )}
      {card?.media &&
        card.media.mediaId !== card.coverMediaId &&
        (card.media.mimeType.startsWith("image/") ? (
          <MarkdownImage
            src={mediaUrl(card.media.mediaId)}
            alt="引用帖子的图片预览"
            loading="lazy"
            className="mt-3 max-h-48 rounded-lg"
          />
        ) : card.media.mimeType.startsWith("video/") || card.media.mimeType.startsWith("audio/") ? (
          <InlineMedia
            mediaId={card.media.mediaId}
            kind={card.media.mimeType.startsWith("video/") ? "video" : "audio"}
          />
        ) : null)}
    </div>
  );
}
