import type { CommentAuthor } from "@/lib/types";
export function Avatar({ author }: { author: CommentAuthor }) {
  return author.avatarUrl
    ? <img src={author.avatarUrl} alt="" loading="lazy" width={28} height={28} className="size-7 shrink-0 rounded-full object-cover" />
    : <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{(author.displayName ?? author.username).slice(0, 1)}</span>;
}
