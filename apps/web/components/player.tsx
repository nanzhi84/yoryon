"use client";

/**
 * 私有媒体播放器（ADR-0005 §8.4）。
 * - src 恒指向 /api/media/:id（302 → 15 分钟签名 URL）；
 * - 签名 URL 过期或网络错误 → 重新请求端点获取新 URL、重置 src 并恢复 currentTime；
 * - 有界重试（F06）：自动重签名刷新最多 1 次，退避后执行；持续失败停止并展示手动重试；
 *   任何 error 不再无限循环改 URL；卸载时取消挂起的重试定时器与事件监听。
 * - 经 next/dynamic 按需加载（见 media-player.tsx），首页信息流不含播放器代码。
 *
 * 实现注意：error/loadedmetadata 监听用原生 addEventListener 经 callback ref 绑定——
 * 实测本链路（@videojs/react Video + React 19）React 的 onError prop 不会在媒体元素上触发。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import { AudioPlayer, AudioSkin, Audio } from "@videojs/react/audio";
import "@videojs/react/video/skin.css";
import "@videojs/react/audio/skin.css";

/** 自动重试上限：签名过期一次刷新即可恢复；仍失败视为持续故障，转人工 */
const AUTO_RETRY_MAX = 1;
/** 自动重试退避（毫秒） */
const RETRY_DELAY_MS = 1500;

interface PlayerState {
  /** 递增强制媒体元素重建（302 重解析） */
  retry: number;
  /** 持续失败：停止自动重试，等待手动重试 */
  failed: boolean;
}

function useRefreshableSource(mediaId: string) {
  const [state, setState] = useState<PlayerState>({ retry: 0, failed: false });
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  /** 已用自动重试次数（手动重试后重置） */
  const autoRetriesRef = useRef(0);
  /** 待恢复的播放进度 */
  const resumeAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  const handleError = useCallback(() => {
    const el = mediaRef.current;
    if (el) resumeAtRef.current = el.currentTime;
    if (autoRetriesRef.current >= AUTO_RETRY_MAX) {
      setState((s) => (s.failed ? s : { ...s, failed: true }));
      return;
    }
    // 有界退避后自动重试（重签名刷新）
    autoRetriesRef.current += 1;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setState((s) => ({ ...s, retry: s.retry + 1 }));
    }, RETRY_DELAY_MS);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    // 加载成功：清除失败态并恢复播放进度
    setState((s) => (s.failed ? { ...s, failed: false } : s));
    const el = mediaRef.current;
    if (el && resumeAtRef.current > 0) {
      el.currentTime = resumeAtRef.current;
      void el.play().catch(() => {});
    }
  }, []);

  // 卸载取消：挂起的重试定时器与媒体事件监听不得越组件生命周期存活
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      detachRef.current?.();
    };
  }, []);

  /** callback ref：绑定/迁移原生媒体事件监听（元素因 key 变化重建时自动迁移） */
  const attachMedia = useCallback(
    (el: HTMLVideoElement | HTMLAudioElement | null) => {
      detachRef.current?.();
      detachRef.current = null;
      mediaRef.current = el;
      if (!el) return;
      el.addEventListener("error", handleError);
      el.addEventListener("loadedmetadata", handleLoadedMetadata);
      detachRef.current = () => {
        el.removeEventListener("error", handleError);
        el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
      // 提交竞态兜底：错误/元数据事件可能先于监听绑定（本地快速失败时），以元素当前状态为准
      if (el.error || el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        handleError();
      } else if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleLoadedMetadata();
      }
    },
    [handleError, handleLoadedMetadata],
  );

  /** 手动重试：重置自动重试计数，强制媒体元素重建 */
  const manualRetry = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    autoRetriesRef.current = 0;
    setState((s) => ({ retry: s.retry + 1, failed: false }));
  }, []);

  // cache-bust 参数仅用于强制浏览器重新解析 302（端点对付费媒体 no-store）
  const src = `/api/media/${mediaId}${state.retry > 0 ? `?r=${state.retry}` : ""}`;
  return { src, attachMedia, manualRetry, retry: state.retry, failed: state.failed };
}

/** 持续失败占位：明确的错误反馈 + 手动重试入口（不再静默无限重试）。 */
function FailedPanel({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg bg-muted text-muted-foreground ${
        compact ? "h-14 flex-row" : "aspect-video"
      }`}
    >
      <span className="text-sm">媒体加载失败</span>
      <button type="button" onClick={onRetry} className="rounded-md border border-border px-3 py-1 text-sm hover:text-foreground">
        重试
      </button>
    </div>
  );
}

export function VideoPlayerView({ mediaId }: { mediaId: string }) {
  const { src, attachMedia, manualRetry, retry, failed } = useRefreshableSource(mediaId);
  if (failed) return <FailedPanel onRetry={manualRetry} />;
  return (
    <VideoPlayer>
      <VideoSkin className="rounded-lg overflow-hidden">
        <Video key={retry} src={src} ref={attachMedia as React.Ref<HTMLVideoElement>} playsInline preload="metadata" />
      </VideoSkin>
    </VideoPlayer>
  );
}

export function AudioPlayerView({ mediaId }: { mediaId: string }) {
  const { src, attachMedia, manualRetry, retry, failed } = useRefreshableSource(mediaId);
  if (failed) return <FailedPanel onRetry={manualRetry} compact />;
  return (
    <AudioPlayer>
      <AudioSkin className="rounded-lg">
        <Audio key={retry} src={src} ref={attachMedia as React.Ref<HTMLAudioElement>} preload="metadata" />
      </AudioSkin>
    </AudioPlayer>
  );
}
