"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AudioPlayerLazy, VideoPlayerLazy } from "./media-player";

/** 用户点击才挂载播放器；另一个媒体开始或离开视口时卸载，防止长 Feed 同时占用资源。 */
export function InlineMedia({ mediaId, kind }: { mediaId: string; kind: "audio" | "video" }) {
  const [active, setActive] = useState(false);
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const change = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) setActive(false); };
    window.addEventListener("yoryon:media-active", change);
    const observer = new IntersectionObserver(entries => { if (!entries.some(e => e.isIntersecting)) setActive(false); });
    if (host.current) observer.observe(host.current);
    return () => { window.removeEventListener("yoryon:media-active", change); observer.disconnect(); };
  }, [id]);
  return <div ref={host} className="not-prose my-4">
    {active ? <>
      {kind === "audio" ? <AudioPlayerLazy mediaId={mediaId} /> : <VideoPlayerLazy mediaId={mediaId} />}
      <button type="button" onClick={() => setActive(false)} className="mt-2 text-sm underline">停止并关闭{kind === "audio" ? "音频" : "视频"}</button>
    </> : <button type="button" className="w-full rounded-lg border bg-muted p-5 text-left" onClick={() => {
      window.dispatchEvent(new CustomEvent("yoryon:media-active", { detail: id })); setActive(true);
    }}>播放{kind === "audio" ? "音频" : "视频"}</button>}
  </div>;
}
