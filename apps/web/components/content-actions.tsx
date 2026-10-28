"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Heart, Repeat2, Check } from "lucide-react";
export function ContentActions({
  slug,
  likeCount = 0,
  commentCount = 0,
}: {
  slug: string;
  likeCount?: number;
  commentCount?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  async function copy() {
    const link = new URL(`/p/${slug}/`, location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setManual(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(link);
    }
  }
  const cls =
    "inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[13px] leading-5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="mt-1">
      <div
        className="flex items-center justify-between text-muted-foreground"
        aria-label="内容互动"
      >
        <Link
          prefetch={false}
          href={`/p/${slug}#comments`}
          className={cls}
          aria-label={`评论，${commentCount}条`}
        >
          <MessageCircle className="size-[17px]" strokeWidth={1.7} aria-hidden="true" />
          <span>{commentCount || "评论"}</span>
        </Link>
        <span className={cls} aria-label={`历史点赞，${likeCount}个赞`}>
          <Heart className="size-[17px]" strokeWidth={1.7} aria-hidden="true" />
          <span>{likeCount || "点赞"}</span>
        </span>
        <button
          type="button"
          className={cls}
          onClick={() => void copy()}
          aria-label="转发，复制链接"
        >
          {copied ? (
            <Check className="size-[17px]" aria-hidden="true" />
          ) : (
            <Repeat2 className="size-[17px]" strokeWidth={1.7} aria-hidden="true" />
          )}
          <span>{copied ? "已复制" : "转发"}</span>
        </button>
      </div>
      <span className="sr-only" role="status">
        {copied ? "链接已复制" : ""}
      </span>
      {manual && (
        <label className="block text-xs text-muted-foreground">
          可手动复制链接
          <input
            aria-label="手动复制作品链接"
            readOnly
            value={manual}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full bg-transparent py-2 text-sm underline"
          />
        </label>
      )}
    </div>
  );
}
