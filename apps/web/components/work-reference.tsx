"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  media: { src: string; mediaId: string; mimeType: string; width: number | null; height: number | null } | null;
}
export function WorkReference({ id, dataRoot }: { id: string; dataRoot: string }) {
  const [card, setCard] = useState<Reference | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const host = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (reload = false) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setCard(null);
    setState("loading");
    try {
      const response = await fetch(`${dataRoot}/references/${id}.json`, {
        cache: reload ? "reload" : "force-cache",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (response.status === 404) {
        if (!controller.signal.aborted) setState("unavailable");
        return;
      }
      if (!response.ok) throw new Error("reference unavailable");
      const raw: unknown = await response.json();
      if (!raw || typeof raw !== "object") throw new Error("invalid reference");
      const data = raw as Reference;
      if (data.available !== true || typeof data.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(data.slug) ||
        !["article", "post"].includes(data.type) || !["title", "summary", "description", "visibility"].every(key => typeof (raw as Record<string, unknown>)[key] === "string") ||
        (data.media !== null && (!data.media || typeof data.media.mediaId !== "string" || typeof data.media.mimeType !== "string" ||
          typeof data.media.src !== "string" || !/^\/media\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(data.media.src)))) throw new Error("invalid reference");
      if (!controller.signal.aborted) {
        setCard(data);
        setState("ready");
      }
    } catch {
      if (!controller.signal.aborted) setState("error");
    }
  }, [id, dataRoot]);
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
          <button onClick={() => void load(true)} className="underline">
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
            src={card.media.src}
            alt="引用帖子的图片预览"
            loading="lazy"
            className="mt-3 max-h-48 rounded-lg"
          />
        ) : card.media.mimeType.startsWith("video/") || card.media.mimeType.startsWith("audio/") ? (
          <InlineMedia
            src={card.media.src}
            kind={card.media.mimeType.startsWith("video/") ? "video" : "audio"}
          />
        ) : null)}
    </div>
  );
}
