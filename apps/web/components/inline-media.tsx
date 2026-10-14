"use client";
import { useEffect, useId, useRef, useState } from "react";
import { VideoPlayerLazy } from "./media-player";
import { Play } from "lucide-react";
import { InlineAudio } from "./inline-audio";

function duration(seconds: number | null | undefined) {
  if (seconds == null || seconds < 0) return null;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

/** 控件无卡片底色；仅视口内视频读取真实首帧，播放器仍在点击后才挂载。 */
export function InlineMedia({ mediaId, kind, durationSec }: { mediaId: string; kind: "audio" | "video"; durationSec?: number | null | undefined }) {
  return kind === "audio" ? <InlineAudio mediaId={mediaId} durationSec={durationSec} /> : <InlineVideo mediaId={mediaId} durationSec={durationSec} />;
}

function InlineVideo({ mediaId, durationSec }: { mediaId: string; durationSec?: number | null | undefined }) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const change = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) setActive(false); };
    window.addEventListener("yoryon:media-active", change);
    const observer = new IntersectionObserver(entries => {
      const shown = entries.some(entry => entry.isIntersecting);
      setVisible(shown); if (!shown) setActive(false);
    });
    if (host.current) observer.observe(host.current);
    return () => { window.removeEventListener("yoryon:media-active", change); observer.disconnect(); };
  }, [id]);
  useEffect(() => {
    const element = preview.current;
    return () => { if (element) { element.pause(); element.removeAttribute("src"); element.load(); } };
  }, [visible, active]);
  const label = "播放视频";
  const time = duration(durationSec);
  function play() {
    window.dispatchEvent(new CustomEvent("yoryon:media-active", { detail: id })); setActive(true);
  }
  return <div ref={host} className="not-prose my-2">
    {active ? <>
      <VideoPlayerLazy mediaId={mediaId} />
      <button type="button" onClick={() => setActive(false)} className="mt-2 min-h-8 text-xs text-muted-foreground hover:text-primary">停止并关闭视频</button>
    </> : <button type="button" aria-label={label} onClick={play}
      className="relative block aspect-video w-full overflow-hidden rounded-lg text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {visible && !previewFailed && <video ref={preview} src={`/api/media/${mediaId}`} muted playsInline preload="metadata" aria-hidden="true"
        className="pointer-events-none h-full w-full object-cover" onError={() => setPreviewFailed(true)}
        onLoadedMetadata={event => { event.currentTarget.currentTime = Math.min(0.01, event.currentTarget.duration / 2); }} />}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-background/90"><Play className="size-5 fill-current" aria-hidden="true" /></span>
      </span>
      {previewFailed && <span className="absolute inset-x-0 bottom-3 text-xs text-muted-foreground">预览未加载，点击播放重试</span>}
      {time && !previewFailed && <span className="absolute right-3 bottom-3 rounded bg-black/50 px-2 py-1 text-xs tabular-nums text-white">{time}</span>}
    </button>}
  </div>;
}
