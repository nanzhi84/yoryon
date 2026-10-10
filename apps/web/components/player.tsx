"use client";

/**
 * 私有媒体播放器（ADR-0005 §8.4）。
 * - src 恒指向 /api/media/:id（302 → 15 分钟签名 URL）；
 * - 签名 URL 过期或网络错误 → 重新请求端点获取新 URL、重置 src 并恢复 currentTime；
 * - 经 next/dynamic 按需加载（见 media-player.tsx），首页信息流不含播放器代码。
 */
import { useCallback, useRef, useState } from "react";
import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import { AudioPlayer, AudioSkin, Audio } from "@videojs/react/audio";
import "@videojs/react/video/skin.css";
import "@videojs/react/audio/skin.css";

interface PlayerState {
  /** 递增强制媒体元素重建（302 重解析） */
  retry: number;
  /** 待恢复的播放进度 */
  resumeAt: number;
}

function useRefreshableSource(mediaId: string) {
  const [state, setState] = useState<PlayerState>({ retry: 0, resumeAt: 0 });
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const onError = useCallback(() => {
    const el = mediaRef.current;
    setState((s) => ({ retry: s.retry + 1, resumeAt: el?.currentTime ?? s.resumeAt }));
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (el && state.resumeAt > 0) {
      el.currentTime = state.resumeAt;
      void el.play().catch(() => {});
    }
  }, [state.resumeAt]);

  // cache-bust 参数仅用于强制浏览器重新解析 302（端点对付费媒体 no-store）
  const src = `/api/media/${mediaId}${state.retry > 0 ? `?r=${state.retry}` : ""}`;
  return { src, onError, onLoadedMetadata, mediaRef, retry: state.retry };
}

export function VideoPlayerView({ mediaId }: { mediaId: string }) {
  const { src, onError, onLoadedMetadata, mediaRef, retry } = useRefreshableSource(mediaId);
  return (
    <VideoPlayer>
      <VideoSkin className="rounded-lg overflow-hidden">
        <Video
          key={retry}
          src={src}
          ref={mediaRef as React.Ref<HTMLVideoElement>}
          onError={onError}
          onLoadedMetadata={onLoadedMetadata}
          playsInline
          preload="metadata"
        />
      </VideoSkin>
    </VideoPlayer>
  );
}

export function AudioPlayerView({ mediaId }: { mediaId: string }) {
  const { src, onError, onLoadedMetadata, mediaRef, retry } = useRefreshableSource(mediaId);
  return (
    <AudioPlayer>
      <AudioSkin className="rounded-lg">
        <Audio
          key={retry}
          src={src}
          ref={mediaRef as React.Ref<HTMLAudioElement>}
          onError={onError}
          onLoadedMetadata={onLoadedMetadata}
          preload="metadata"
        />
      </AudioSkin>
    </AudioPlayer>
  );
}
