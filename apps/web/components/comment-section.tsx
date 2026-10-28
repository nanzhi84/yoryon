import type { StaticContent } from "@yoryon/config/static-site";
import { Heart } from "lucide-react";
type Comment = StaticContent["comments"][number];
function Entry({ item }: { item: Comment }) {
  return (
    <div id={`comment-${item.id}`} className="scroll-mt-6 py-3">
      {item.deleted ? (
        <p className="text-sm text-muted-foreground">评论已删除</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{item.author}</span>
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Singapore",
                hour12: false,
              })}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {item.body}
          </p>
          <span
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
            aria-label={`历史点赞${item.likeCount}`}
          >
            <Heart className="size-3.5" aria-hidden="true" />
            {item.likeCount}
          </span>
        </>
      )}
    </div>
  );
}
export function CommentSection({ comments }: { comments: Comment[] }) {
  const roots = comments.filter((c) => c.parentId === null);
  const total = comments.filter((c) => !c.deleted).length;
  return (
    <section
      id="comments"
      className="mt-6 scroll-mt-6 border-t border-border pt-6"
      aria-label="评论区"
    >
      <h2 className="text-lg font-semibold">评论{total ? `（${total}）` : ""}</h2>
      <p className="mt-3 text-sm text-muted-foreground">评论已归档，仅供阅读。</p>
      {roots.length ? (
        <div className="mt-4 divide-y divide-border">
          {roots.map((item) => (
            <div key={item.id}>
              <Entry item={item} />
              {comments.some((c) => c.parentId === item.id) && (
                <details className="ml-4 mb-3 border-l pl-4">
                  <summary className="min-h-11 text-xs text-muted-foreground">查看回复</summary>
                  {comments
                    .filter((c) => c.parentId === item.id)
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((reply) => (
                      <Entry key={reply.id} item={reply} />
                    ))}
                </details>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">还没有评论。</p>
      )}
    </section>
  );
}
