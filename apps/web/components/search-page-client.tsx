"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./ui/button";
import { LoadMore } from "./load-more";
import { formatDate } from "@/lib/date";
import { SEARCH_PAGE_SIZE, type MatchedText, type SearchResponse } from "@/lib/search/format";
import { useStaticSearch } from "@/lib/search/use-search";
import { BROWSE_LAYOUT_READY, readBrowse, writeBrowse } from "@/lib/browse-memory";
function HighlightedText({ text }: { text: MatchedText }) {
  return <>{text.before}<mark className="rounded-sm bg-yellow-300 text-zinc-900">{text.match}</mark>{text.after}</>;
}
function SearchBlock({ result, query }: { result: SearchResponse; query: string }) {
  const host = useRef<HTMLDivElement>(null);
  const height = useRef(1);
  const [near, setNear] = useState(true);
  useLayoutEffect(() => {
    if (!near || !host.current) return;
    const element = host.current;
    const measure = () => { height.current = element.getBoundingClientRect().height; };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [near]);
  useEffect(() => {
    if (!host.current || !("IntersectionObserver" in window)) return;
    const element = host.current;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visible || !element.contains(document.activeElement)) setNear(visible);
    }, { rootMargin: "1600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} data-search-block={result.page} style={near ? undefined : { height: height.current }} className="divide-y divide-border">
    {near && result.items.map(item => <article key={item.slug} className="py-5">
      <Link prefetch={false} href={`/p/${item.slug}?q=${encodeURIComponent(query)}`} className="break-words text-lg font-semibold hover:underline">
        {item.titleMatch ? <HighlightedText text={item.titleMatch} /> : item.title || `帖子 · ${formatDate(item.publishedAt)}`}
      </Link>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.snippet ? <HighlightedText text={item.snippet} /> : item.description}</p>
      <time dateTime={item.publishedAt ?? undefined} className="mt-3 block text-xs text-muted-foreground">{formatDate(item.publishedAt)}</time>
    </article>)}
  </div>;
}
function SearchResults({ root, query, first }: { root: string; query: string; first: number }) {
  const [page, setPage] = useState(first);
  const [chunks, setChunks] = useState<SearchResponse[]>([]);
  const target = useRef(first);
  const memoryKey = `search-end:${root}:${query}:${first}`;
  const { result, loading, error, retry } = useStaticSearch(root, query, page);
  useLayoutEffect(() => {
    const saved = readBrowse<number>(memoryKey);
    if (saved && Number.isSafeInteger(saved) && saved >= first) target.current = saved;
  }, [first, memoryKey]);
  useEffect(() => {
    if (!result) return;
    setChunks(previous => previous.some(chunk => chunk.page === result.page) ? previous : [...previous, result]);
    const lastPage = Math.max(1, Math.ceil(result.total / SEARCH_PAGE_SIZE));
    target.current = Math.min(target.current, lastPage);
    if (result.page < target.current) setPage(result.page + 1);
    else writeBrowse(memoryKey, result.page);
  }, [result, memoryKey]);
  const last = chunks.at(-1);
  const restoring = !!query && (!last || last.page < target.current) && !error;
  useEffect(() => {
    if (!restoring) window.dispatchEvent(new Event(BROWSE_LAYOUT_READY));
  }, [restoring, chunks]);
  const append = useCallback((reload: boolean) => {
    if (reload) { retry(); return; }
    if (!loading && last && last.page === page) setPage(page + 1);
  }, [loading, last, page, retry]);
  return <>
    {loading && !last && <p role="status" className="mt-5 text-sm text-muted-foreground">正在搜索…</p>}
    {error && !last && <p role="alert" className="mt-5 text-sm">{error}<button onClick={retry} className="ml-2 min-h-11 underline">重试</button></p>}
    {last && <p role="status" className="mt-5 text-sm text-muted-foreground">找到 {last.total} 篇内容</p>}
    {first > 1 && <Link href={`/search/?q=${encodeURIComponent(query)}`} className="my-3 inline-flex min-h-11 items-center text-sm text-primary underline">从头浏览</Link>}
    <div className="divide-y divide-border" aria-busy={loading} data-browse-ready={restoring ? "false" : "true"}>
      {chunks.map(chunk => <SearchBlock key={chunk.page} result={chunk} query={query} />)}
    </div>
    <LoadMore more={!!last && last.page * SEARCH_PAGE_SIZE < last.total} loading={loading} error={error} onLoad={append} />
  </>;
}
export function SearchPageClient({ root }: { root: string }) {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, 120).trim();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  function navigate(next: string) {
    const url = new URL(location.href);
    if (next) url.searchParams.set("q", next); else url.searchParams.delete("q");
    url.searchParams.delete("page");
    history.replaceState(null, "", url.pathname + url.search);
  }
  return <>
    <form onSubmit={event => { event.preventDefault(); navigate(draft.trim()); }} className="mt-5 flex items-center gap-2">
      <label className="sr-only" htmlFor="search-input">搜索关键词</label>
      <input id="search-input" type="search" maxLength={120} value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="搜索文章、帖子与正文" className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm" />
      <Button type="submit">搜索</Button>
    </form>
    <p className="mt-3 text-xs text-muted-foreground">搜索当前可阅读的内容。</p>
    <SearchResults key={`${root}:${query}:${page}`} root={root} query={query} first={page} />
  </>;
}
