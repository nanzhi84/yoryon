"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import type { CollectionDetail } from "@/lib/types";
import { formatDate } from "@/lib/date";
import { collectionPositionKey, readCollectionPosition } from "@/lib/collection-memory";
import { DetailTracker } from "./analytics";
import { chapterHref, useCollectionFlow, useCollectionTime } from "./collection-flow";
import { CollectionDescription } from "./collection-description";
import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";

export function CollectionReader({ initial }: { initial: CollectionDetail }) {
  const [collection, setCollection] = useState(initial);
  const [lastId, setLastId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [error, setError] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const holder = useCollectionFlow();
  const startedId = useRef<string | null>(null);
  useEffect(() => {
    const old = holder.current;
    const requested = new URL(location.href).searchParams.get("flow");
    if (!old || old.collectionId !== initial.id || (requested && requested !== old.id && startedId.current !== old.id)) {
      holder.current = { id: crypto.randomUUID(), collectionId: initial.id, slug: initial.slug, elapsed: 0, sent: false, navigating: false };
    }
    startedId.current = holder.current!.id;
    setFlowId(holder.current!.id);
  }, [holder, initial.id, initial.slug]);
  useCollectionTime(flowId, true);

  useEffect(() => {
    let controller: AbortController | null = null;
    let current = initial;
    const restore = () => {
      const position = readCollectionPosition(current.id, new Set(current.items.map(item => item.id)));
      setLastId(position?.chapterId ?? null);
      setReady(true);
    };
    const refresh = async () => {
      controller?.abort(); controller = new AbortController();
      const active = controller;
      try {
        const response = await fetch(`/api/collections/${initial.slug}`, { cache: "no-store", signal: active.signal });
        if (!response.ok) throw new Error("directory unavailable");
        const data = await response.json() as CollectionDetail;
        if (data.id !== initial.id || !Array.isArray(data.items)) throw new Error("invalid directory");
        current = data; setCollection(data); setError(false); restore();
      } catch { if (!active.signal.aborted) { setError(true); restore(); } }
    };
    restore();
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === collectionPositionKey(initial.id)) restore(); };
    const visibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    return () => { controller?.abort(); window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("focus", visibility); };
  }, [initial]);

  const last = collection.items.find(item => item.id === lastId);
  const start = last ?? collection.items[0];
  const ordered = reverse ? [...collection.items].reverse() : collection.items;
  return <main className="py-5">
    <DetailTracker targetKind="collection" targetId={collection.id} readEnabled={false} />
    <Link prefetch={false} href="/c" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" />返回合集</Link>
    <header className="mt-3">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">合集 · {collection.items.length} 篇</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{collection.title}</h1>
          {collection.description && <CollectionDescription description={collection.description} className="mt-3" />}
        </div>
        {collection.coverMediaId && <div className="w-24 shrink-0 sm:w-36"><div className="aspect-square overflow-hidden rounded-lg bg-muted"><img src={publicImageUrl(collection.coverMediaId)} srcSet={imageSrcSet(collection.coverMediaId, undefined, true)} sizes="(min-width: 640px) 144px, 96px" alt={collection.title} decoding="async" className="h-full w-full object-cover" /></div></div>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground"><time dateTime={collection.updatedAt}>更新于 {formatDate(collection.updatedAt)}</time></p>
      {start && <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
        {ready && flowId ? <Link prefetch={false} href={chapterHref(start.slug, collection.slug, flowId)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">{last ? "继续阅读" : "开始阅读"}<ArrowRight className="size-4" /></Link> : <div className="h-11 w-32 animate-pulse rounded-md bg-muted" aria-label="正在读取阅读位置" />}
        {ready && last && <p className="text-xs text-muted-foreground">上次读到：{last.title || last.slug}</p>}
      </div>}
    </header>
    {error && <p className="mt-4 text-sm text-muted-foreground" role="status">目录更新暂时失败。<button className="min-h-11 text-primary underline" onClick={() => location.reload()}>重新加载</button></p>}
    <section className="mt-6 border-t border-border pt-4" aria-label="章节目录">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">章节目录</h2>
        <div className="flex items-center gap-3 text-sm"><button className="min-h-11" aria-pressed={!reverse} onClick={() => setReverse(false)}>正序</button><button className="min-h-11" aria-pressed={reverse} onClick={() => setReverse(true)}>倒序</button></div>
      </div>
      {!ordered.length && <p className="py-6 text-center text-sm text-muted-foreground">合集暂无已发布章节。</p>}
      <ol className="divide-y divide-border">
        {ordered.map(item => <li key={item.id} className={item.id === lastId ? "rounded-md bg-primary/5" : ""}>
          <Link prefetch={false} href={chapterHref(item.slug, collection.slug, flowId)} className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary">
            <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{String(collection.items.indexOf(item) + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 break-words">{item.title || item.slug}{item.id === lastId && <span className="ml-2 text-xs text-primary">上次阅读</span>}</span>
            <time dateTime={item.publishedAt ?? undefined} className="shrink-0 text-xs text-muted-foreground">{formatDate(item.publishedAt)}</time>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">{item.visibility === "paid" ? <><Lock className="size-3" />会员</> : "免费"}</span>
          </Link>
        </li>)}
      </ol>
    </section>
  </main>;
}
