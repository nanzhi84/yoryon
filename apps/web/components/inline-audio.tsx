"use client";
import { mediaUrl } from "@/lib/media";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

function time(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}

/** 控件与audio元素始终不替换，src和play在同一用户手势内设置；只加载正在使用的音频。 */
export function InlineAudio({
  mediaId,
  durationSec,
}: {
  mediaId: string;
  durationSec?: number | null | undefined;
}) {
  const id = useId();
  const audio = useRef<HTMLAudioElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const intent = useRef(false);
  const retryCount = useRef(0);
  const sourceVersion = useRef(0);
  const resume = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(durationSec ?? 0);
  const [error, setError] = useState(false);
  function clearTimers() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (deadline.current) clearTimeout(deadline.current);
    retryTimer.current = null;
    deadline.current = null;
  }
  function pause() {
    intent.current = false;
    clearTimers();
    audio.current?.pause();
    setPlaying(false);
    setLoading(false);
  }
  function start(reload = false) {
    const element = audio.current;
    if (!element) return;
    intent.current = true;
    setError(false);
    setLoading(true);
    if (!element.getAttribute("src") || reload) {
      element.src = mediaUrl(mediaId);
      element.load();
    }
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = setTimeout(() => {
      if (intent.current) {
        pause();
        setError(true);
      }
    }, 15_000);
    void element
      .play()
      .then(() => {
        if (intent.current) {
          setLoading(false);
          if (deadline.current) clearTimeout(deadline.current);
        }
      })
      .catch((reason) => {
        if (!intent.current || reason?.name === "AbortError" || retryTimer.current) return;
        // 媒体网络错误由error事件负责一次有界重载；权限/手势拒绝则明确转手动重试。
        if (!element.error) {
          pause();
          setError(true);
        }
      });
  }
  function failed() {
    resume.current = audio.current?.currentTime ?? position;
    if (!intent.current || retryCount.current >= 1) {
      pause();
      setError(true);
      return;
    }
    if (retryTimer.current) return;
    retryCount.current++;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      sourceVersion.current++;
      start(true);
    }, 1200);
  }
  function toggle() {
    if (intent.current || playing) {
      pause();
      return;
    }
    window.dispatchEvent(new CustomEvent("yoryon:media-active", { detail: id }));
    if (error) {
      retryCount.current = 0;
      sourceVersion.current++;
      start(true);
    } else {
      start();
    }
  }
  useEffect(() => {
    const element = audio.current;
    const release = () => {
      if (element?.getAttribute("src")) {
        resume.current = element.currentTime;
        pause();
        element.removeAttribute("src");
        element.load();
      }
    };
    const stop = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) pause();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) release();
    });
    if (host.current) observer.observe(host.current);
    window.addEventListener("yoryon:media-active", stop);
    return () => {
      intent.current = false;
      clearTimers();
      observer.disconnect();
      window.removeEventListener("yoryon:media-active", stop);
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [id]);
  return (
    <div ref={host} className="not-prose my-2">
      <div className="flex min-h-11 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing || loading ? "暂停音频" : error ? "重试播放音频" : "播放音频"}
          aria-busy={loading}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="size-5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-5 fill-current" aria-hidden="true" />
          )}
        </button>
        <span className="shrink-0 text-[13px] leading-5 font-medium">音频</span>
        <input
          type="range"
          aria-label="音频进度"
          min={0}
          max={total || 1}
          step={0.01}
          value={Math.min(position, total || 1)}
          disabled={!total}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (audio.current && total) {
              audio.current.currentTime = value;
              setPosition(value);
            }
          }}
          className="h-1 min-w-0 flex-1 accent-primary disabled:opacity-40"
        />
        <span className="w-[6.5rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {time(position)} / {total ? time(total) : "--:--"}
        </span>
      </div>
      <audio
        ref={audio}
        preload="none"
        aria-hidden="true"
        onError={failed}
        onPlay={(event) => setPlaying(intent.current && !event.currentTarget.paused)}
        onPause={(event) => setPlaying(intent.current && !event.currentTarget.paused)}
        onWaiting={() => {
          if (intent.current) setLoading(true);
        }}
        onPlaying={(event) => {
          setPlaying(intent.current && !event.currentTarget.paused);
          setLoading(false);
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.getAttribute("src")) setPosition(event.currentTarget.currentTime);
        }}
        onEnded={() => {
          intent.current = false;
          clearTimers();
          setPlaying(false);
          setLoading(false);
        }}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          if (Number.isFinite(element.duration) && element.duration > 0) {
            setTotal(element.duration);
            if (resume.current > 0)
              element.currentTime = Math.min(resume.current, element.duration);
          }
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-muted-foreground">
          音频未能播放，点击播放按钮重试。
        </p>
      )}
    </div>
  );
}
