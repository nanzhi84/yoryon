import type { CommentAuthor } from "@/lib/types";
export function Avatar({ author, size = 28 }: { author: CommentAuthor; size?: 28 | 64 }) {
  return author.avatarUrl
    ? <img src={author.avatarUrl} alt="" loading="lazy" width={size} height={size} className={`${size === 64 ? "size-16" : "size-7"} shrink-0 rounded-full object-cover`} />
    : <span aria-hidden="true" className={`inline-flex ${size === 64 ? "size-16 text-2xl" : "size-7 text-xs"} shrink-0 items-center justify-center rounded-full bg-muted`}>{[...(author.displayName ?? author.username)][0]}</span>;
}
