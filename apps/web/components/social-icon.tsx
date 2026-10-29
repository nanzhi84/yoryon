import { BookOpen, Github, MessagesSquare, Music2 } from "lucide-react";
import type { SocialPlatform } from "@/lib/social-links";

const icons = { github: Github, wechat: MessagesSquare, xiaohongshu: BookOpen, douyin: Music2 };

export function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "x") {
    return (
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.8 8.9L23.4 22h-7.2l-5.7-7.5L3.9 22H.7l8.3-9.5L.6 2H8l5.2 6.9L18.9 2ZM17.1 20h2L6.9 4H4.8l12.3 16Z" />
      </svg>
    );
  }
  const Icon = icons[platform];
  return <Icon className="size-5 shrink-0" aria-hidden="true" />;
}
