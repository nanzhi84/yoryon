"use client";

/** 播放器按需加载边界（ADR-0005 §8.4）：首页信息流不含播放器代码。 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const VideoPlayerLazy = dynamic(() => import("@/components/player").then((m) => m.VideoPlayerView), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
});

export const AudioPlayerLazy = dynamic(() => import("@/components/player").then((m) => m.AudioPlayerView), {
  ssr: false,
  loading: () => <Skeleton className="h-14 w-full rounded-lg" />,
});
