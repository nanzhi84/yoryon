"use client";

/** 播放器按需加载边界（ADR-0005 §8.4）：播放器仅在用户操作后挂载。 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const VideoPlayerLazy = dynamic(() => import("@/components/player").then((m) => m.VideoPlayerView), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
});
