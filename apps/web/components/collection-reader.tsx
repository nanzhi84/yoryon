"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { BackLink } from "./back-link";
import { formatDate } from "@/lib/date";
import { chapterHref } from "@/lib/collection-links";
import { useCollectionResume, type ChapterItem } from "@/lib/collection-resume";
import { PAGE_SIZE, pagePath } from "@/lib/pagination";
import { Pagination } from "./pagination";

export function CollectionReader({ collection, items, first, page, reverse, description, lookup }: {
  collection: { id: string; slug: string; title: string; updatedAt: string; total: number };
  items: ChapterItem[]; first: ChapterItem | null; page: number; reverse: boolean;
  description: ReactNode; lookup: string;
}) {
  const { last, failed, retry } = useCollectionResume(collection.id, lookup, items, first, collection.total);
  const start = last ?? first;
  const base = `/c/${collection.slug}`;
  const orderedBase = reverse ? `${base}/reverse` : base;
  const lastPage = last ? Math.floor((reverse ? collection.total - last.position : last.position - 1) / PAGE_SIZE) + 1 : 1;
  return <main className="py-5">
    <BackLink href="/c">返回合集</BackLink>
    <header className="mt-3">
      <p className="text-sm text-muted-foreground">合集 · {collection.total} 篇</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{collection.title}</h1>
      {description}
      <p className="mt-3 text-xs text-muted-foreground"><time dateTime={collection.updatedAt}>更新于 {formatDate(collection.updatedAt)}</time></p>
      {start && <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
        <Link prefetch href={chapterHref(start.slug, collection.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
          {last ? "继续阅读" : "开始阅读"}<ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        {last && <p className="text-xs text-muted-foreground">上次读到：{last.title || last.slug}
          {lastPage !== page && <Link href={pagePath(orderedBase, lastPage)} className="ml-2 text-primary underline">查看所在目录页</Link>}
        </p>}
      </div>}
      {failed && <p role="alert" className="mt-3 text-sm text-muted-foreground">续读位置暂时无法读取。<button onClick={retry} className="ml-2 min-h-11 underline">重试</button></p>}
    </header>
    <section className="mt-6 border-t border-border pt-4" aria-label="章节目录">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">章节目录</h2>
        <nav aria-label="目录排序" className="flex items-center gap-3 text-sm">
          <Link prefetch href={base} aria-current={!reverse ? "page" : undefined} className={`flex min-h-11 items-center ${!reverse ? "text-primary" : ""}`}>正序</Link>
          <Link prefetch href={`${base}/reverse`} aria-current={reverse ? "page" : undefined} className={`flex min-h-11 items-center ${reverse ? "text-primary" : ""}`}>倒序</Link>
        </nav>
      </div>
      {!items.length && <p className="py-6 text-center text-sm text-muted-foreground">合集暂无已发布章节。</p>}
      <ol className="divide-y divide-border">
        {items.map(item => <li key={item.id} className={item.id === last?.id ? "rounded-md bg-primary/5" : ""}>
          <Link prefetch href={chapterHref(item.slug, collection.slug)} className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary">
            <span className="min-w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{String(item.position).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 break-words">{item.title || item.slug}{item.id === last?.id && <span className="ml-2 text-xs text-primary">上次阅读</span>}</span>
            <time dateTime={item.publishedAt ?? undefined} className="shrink-0 text-xs text-muted-foreground">{formatDate(item.publishedAt)}</time>
          </Link>
        </li>)}
      </ol>
      <Pagination base={orderedBase} page={page} total={collection.total} />
    </section>
  </main>;
}
