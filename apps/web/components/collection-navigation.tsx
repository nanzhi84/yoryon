import Link from "next/link";
import type { ContentDetail } from "@/lib/types";

/** 只导航到公开可发现的作品地址，目标正文继续由详情接口判断阅读权限。 */
export function CollectionNavigation({ collections }: { collections: ContentDetail["collections"] }) {
  if (!collections.length) return null;
  return <nav aria-label="合集上下篇导航" className="mt-10 space-y-6 border-t pt-6">
    {collections.map(collection => <section key={collection.slug} aria-label={`合集：${collection.title}`}>
      <Link prefetch={false} href={`/c/${collection.slug}`} className="text-sm font-medium underline underline-offset-4">合集：{collection.title}</Link>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {collection.previous ? <Link prefetch={false} href={`/p/${collection.previous.slug}`} rel="prev" className="rounded-md border p-3 hover:bg-muted">
          <span className="block text-xs text-muted-foreground">上一篇</span>
          <span className="mt-1 block break-words">{collection.previous.title || collection.previous.slug}</span>
        </Link> : <p className="p-3 text-muted-foreground">已是合集第一篇</p>}
        {collection.next ? <Link prefetch={false} href={`/p/${collection.next.slug}`} rel="next" className="rounded-md border p-3 hover:bg-muted">
          <span className="block text-xs text-muted-foreground">下一篇</span>
          <span className="mt-1 block break-words">{collection.next.title || collection.next.slug}</span>
        </Link> : <p className="p-3 text-muted-foreground">已是合集最后一篇</p>}
      </div>
    </section>)}
  </nav>;
}
