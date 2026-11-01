import Link from "next/link";
import { pageCount, pagePath } from "@/lib/pagination";
export function Pagination({ base, page, total }: { base: string; page: number; total: number }) {
  const pages = pageCount(total);
  if (pages < 2) return null;
  const className = "inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm hover:text-primary";
  return <nav aria-label="分页" className="mt-6 flex flex-wrap items-center justify-between gap-3 pb-6">
    {page > 1 ? <Link prefetch href={pagePath(base, page - 1)} rel="prev" className={className}>上一页</Link> : <span />}
    <span className="text-xs text-muted-foreground">第 {page} / {pages} 页 · 共 {total} 条</span>
    {page < pages ? <Link prefetch href={pagePath(base, page + 1)} rel="next" className={className}>下一页</Link> : <span />}
  </nav>;
}
