"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./ui/button";
import { formatDate } from "@/lib/date";
import { SEARCH_PAGE_SIZE, type MatchedText } from "@/lib/search/format";
import { useStaticSearch } from "@/lib/search/use-search";
function HighlightedText({ text }: { text: MatchedText }) {
  return <>{text.before}<mark className="rounded-sm bg-yellow-300 text-zinc-900">{text.match}</mark>{text.after}</>;
}
export function SearchPageClient({ root }: { root: string }) {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, 120).trim();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const { result, loading, error, retry } = useStaticSearch(root, query, page);
  function navigate(next: string, nextPage = 1) {
    const url = new URL(location.href);
    if (next) url.searchParams.set("q", next); else url.searchParams.delete("q");
    if (nextPage > 1) url.searchParams.set("page", String(nextPage)); else url.searchParams.delete("page");
    history.replaceState(null, "", url.pathname + url.search);
  }
  const pages = result ? Math.ceil(result.total / SEARCH_PAGE_SIZE) : 0;
  return <>
    <form onSubmit={event => { event.preventDefault(); navigate(draft.trim()); }} className="mt-5 flex items-center gap-2">
      <label className="sr-only" htmlFor="search-input">搜索关键词</label>
      <input id="search-input" type="search" maxLength={120} value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="搜索文章、帖子与正文" className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm" />
      <Button type="submit">搜索</Button>
    </form>
    <p className="mt-3 text-xs text-muted-foreground">搜索当前可阅读的内容。</p>
    {loading && <p role="status" className="mt-5 text-sm text-muted-foreground">正在搜索…</p>}
    {error && <p role="alert" className="mt-5 text-sm">{error}<button onClick={retry} className="ml-2 min-h-11 underline">重试</button></p>}
    {result && <p role="status" className="mt-5 text-sm text-muted-foreground">找到 {result.total} 篇内容</p>}
    <div className="divide-y divide-border" aria-busy={loading} data-browse-ready={loading ? "false" : "true"}>
      {result?.items.map(item => <article key={item.slug} className="py-5">
        <Link prefetch={false} href={`/p/${item.slug}?q=${encodeURIComponent(query)}`} className="break-words text-lg font-semibold hover:underline">
          {item.titleMatch ? <HighlightedText text={item.titleMatch} /> : item.title || `帖子 · ${formatDate(item.publishedAt)}`}
        </Link>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.snippet ? <HighlightedText text={item.snippet} /> : item.description}</p>
        <time dateTime={item.publishedAt ?? undefined} className="mt-3 block text-xs text-muted-foreground">{formatDate(item.publishedAt)}</time>
      </article>)}
    </div>
    {result && pages > 1 && <nav aria-label="搜索结果分页" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" disabled={result.page === 1} onClick={() => navigate(query, result.page - 1)}>上一页结果</Button>
      <span className="text-xs text-muted-foreground">第 {result.page} / {pages} 页</span>
      <Button variant="outline" disabled={result.page === pages} onClick={() => navigate(query, result.page + 1)}>下一页结果</Button>
    </nav>}
  </>;
}
