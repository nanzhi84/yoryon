"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { CollectionDetail } from "@/lib/types";
import { BackLink } from "./back-link";
import { formatDate } from "@/lib/date";
import { collectionPositionKey, readCollectionPosition } from "@/lib/collection-memory";
import { chapterHref } from "@/lib/collection-links";
import { CollectionDescription } from "./collection-description";
export function CollectionReader({ initial: collection }: { initial: CollectionDetail }) {
  const [lastId, setLastId] = useState<string | null>(null);
  const [reverse, setReverse] = useState(false);
  useEffect(() => {
    const restore = () =>
      setLastId(
        readCollectionPosition(collection.id, new Set(collection.items.map((c) => c.id)))
          ?.chapterId ?? null
      );
    restore();
    const storage = (e: StorageEvent) => {
      if (e.key === null || e.key === collectionPositionKey(collection.id)) restore();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", restore);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", restore);
    };
  }, [collection]);
  const last = collection.items.find((c) => c.id === lastId);
  const start = last ?? collection.items[0];
  const ordered = reverse ? [...collection.items].reverse() : collection.items;
  return (
    <main className="py-5">
      <BackLink href="/c">返回合集</BackLink>
      <header className="mt-3">
        <p className="text-sm text-muted-foreground">合集 · {collection.items.length} 篇</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">{collection.title}</h1>
        {collection.description && (
          <CollectionDescription description={collection.description} className="mt-3" />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          <time dateTime={collection.updatedAt}>更新于 {formatDate(collection.updatedAt)}</time>
        </p>
        {start && (
          <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
            <Link
              prefetch={false}
              href={chapterHref(start.slug, collection.slug)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              {last ? "继续阅读" : "开始阅读"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {last && (
              <p className="text-xs text-muted-foreground">上次读到：{last.title || last.slug}</p>
            )}
          </div>
        )}
      </header>
      <section className="mt-6 border-t border-border pt-4" aria-label="章节目录">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">章节目录</h2>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              className="min-h-11"
              aria-pressed={!reverse}
              onClick={() => setReverse(false)}
            >
              正序
            </button>
            <button
              type="button"
              className="min-h-11"
              aria-pressed={reverse}
              onClick={() => setReverse(true)}
            >
              倒序
            </button>
          </div>
        </div>
        {!ordered.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">合集暂无已发布章节。</p>
        )}
        <ol className="divide-y divide-border">
          {ordered.map((item) => (
            <li key={item.id} className={item.id === lastId ? "rounded-md bg-primary/5" : ""}>
              <Link
                prefetch={false}
                href={chapterHref(item.slug, collection.slug)}
                className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary"
              >
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {String(collection.items.indexOf(item) + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {item.title || item.slug}
                  {item.id === lastId && (
                    <span className="ml-2 text-xs text-primary">上次阅读</span>
                  )}
                </span>
                <time
                  dateTime={item.publishedAt ?? undefined}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatDate(item.publishedAt)}
                </time>
                {item.access === "preview" && (
                  <span className="shrink-0 text-xs text-muted-foreground">预览</span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
