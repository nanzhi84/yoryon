"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./ui/button";
import { formatDate } from "@/lib/date";
interface Item {
  id: string;
  slug: string;
  title: string;
  description: string;
  text: string;
  publishedAt: string | null;
  type: "article" | "post";
}

interface MatchedText {
  before: string;
  match: string;
  after: string;
}

function matchText(text: string, pattern: RegExp, excerpt = false): MatchedText | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const hitStart = match.index;
  const hitEnd = hitStart + match[0].length;
  let start = 0;
  let end = text.length;
  if (excerpt) {
    start = Math.max(0, hitStart - 45);
    // Look from the next position so overlapping occurrences also stop the excerpt.
    const next = pattern.exec(text.slice(hitStart + 1));
    end = Math.min(
      text.length,
      hitEnd + 65,
      next ? Math.max(hitEnd, hitStart + 1 + next.index) : Infinity
    );
    // Keep emoji and other surrogate pairs intact at the context boundaries.
    if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start]!)) start++;
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
  }
  return {
    before: `${start > 0 ? "…" : ""}${text.slice(start, hitStart)}`,
    match: match[0],
    after: `${text.slice(hitEnd, end)}${end < text.length ? "…" : ""}`,
  };
}

function HighlightedText({ text }: { text: MatchedText }) {
  return (
    <>
      {text.before}
      <mark className="rounded-sm bg-yellow-300 text-zinc-900">{text.match}</mark>
      {text.after}
    </>
  );
}

export function SearchPageClient({ items }: { items: Item[] }) {
  const params = useSearchParams();
  const selected = (params.get("q") ?? "").slice(0, 120);
  const [draft, setDraft] = useState(selected);
  const [query, setQuery] = useState(selected);
  const [limit, setLimit] = useState(20);
  useEffect(() => {
    setDraft(selected);
    setQuery(selected);
    setLimit(20);
  }, [selected]);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    // Escape literal input; matching original text keeps highlight offsets correct.
    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu");
    return items.flatMap((item) => {
      const titleMatch = matchText(item.title, pattern);
      const snippet = matchText(item.text, pattern, true) ?? matchText(item.description, pattern, true);
      if (!titleMatch && !snippet) return [];
      return [
        {
          ...item,
          titleMatch,
          snippet,
        },
      ];
    });
  }, [items, query]);
  function search(event: React.FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    setQuery(next);
    setLimit(20);
    const url = new URL(location.href);
    if (next) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + url.search);
  }
  return (
    <>
      <form onSubmit={search} className="mt-5 flex items-center gap-2">
        <label className="sr-only" htmlFor="search-input">
          搜索关键词
        </label>
        <input
          id="search-input"
          type="search"
          maxLength={120}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="搜索文章、帖子与正文"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <Button type="submit">搜索</Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">搜索当前可阅读的内容。</p>
      {query.trim() && (
        <div role="status" className="mt-5 text-sm text-muted-foreground">
          找到 {results.length} 篇内容
        </div>
      )}
      <div className="divide-y divide-border">
        {results.slice(0, limit).map((item) => (
          <article key={item.id} className="py-5">
            <Link
              prefetch={false}
              href={`/p/${item.slug}?q=${encodeURIComponent(query)}`}
              className="break-words text-lg font-semibold hover:underline"
            >
              {item.titleMatch ? (
                <HighlightedText text={item.titleMatch} />
              ) : (
                item.title || `帖子 · ${formatDate(item.publishedAt)}`
              )}
            </Link>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {item.snippet ? <HighlightedText text={item.snippet} /> : item.description}
            </p>
            <time
              dateTime={item.publishedAt ?? undefined}
              className="mt-3 block text-xs text-muted-foreground"
            >
              {formatDate(item.publishedAt)}
            </time>
          </article>
        ))}
      </div>
      {results.length > limit && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setLimit((n) => n + 20)}
        >
          加载更多结果
        </Button>
      )}
    </>
  );
}
