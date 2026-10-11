"use client";

/** 播放器按需加载边界（ADR-0005 §8.4）：首页信息流不含播放器代码。 */
import dynamic from "next/dynamic";
import { Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const VideoPlayerLazy = dynamic(() => import("@/components/player").then((m) => m.VideoPlayerView), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
});

export const AudioPlayerLazy = dynamic(() => import("@/components/player").then((m) => m.AudioPlayerView), {
  ssr: false,
  loading: () => <Skeleton className="h-14 w-full rounded-lg" />,
});

/**
 * 音频内容卡片（播客式）：封面 + 标题/简介 + 播放器。
 * 仅用于音频类型内容页的主媒体；正文内联 ::audio 仍用裸 AudioPlayerLazy。
 */
export function AudioFeature({
  mediaId,
  title,
  description,
  coverMediaId,
}: {
  mediaId: string;
  title: string;
  description: string;
  coverMediaId: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        {coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${coverMediaId}`} alt={title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-background">
            <Music className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Now Playing</p>
          <p className="mt-0.5 truncate font-medium">{title}</p>
          {description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="mt-4">
        <AudioPlayerLazy mediaId={mediaId} />
      </div>
    </div>
  );
}
