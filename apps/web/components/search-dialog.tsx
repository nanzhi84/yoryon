"use client";
import Link from 'next/link';
import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { Button } from './ui/button';
import type { SearchHit } from '@yoryon/config/search-text';
type Item = { id: string; slug: string; title: string; description: string; publishedAt: string | null; visibility: 'public' | 'paid'; canAccess: boolean; revision?: string; hits?: SearchHit[] };
type Result = { session: string; query: string; results: Item[]; nextCursor: number | null; bodySearch: boolean; quota: { remaining: number | null; releasesAt: string | null } };
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const parts = text.split(query);
  return <>{parts.map((p,i) => <span key={i}>{i > 0 && <mark className="rounded bg-yellow-200 text-black">{query}</mark>}{p}</span>)}</>;
}
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exhausted, setExhausted] = useState(false);
  const [releases, setReleases] = useState<string | null>(null);
  const request = useRef<{ query: string; requestId: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const pending = useRef(false);
  async function submit(more = false) {
    if (pending.current || !query.trim()) return;
    pending.current = true; setBusy(true); setError(''); setExhausted(false);
    const controller = new AbortController(); active.current = controller;
    if (!more && request.current?.query !== query) request.current = { query, requestId: crypto.randomUUID() };
    try {
      const response = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(more && result ? { session: result.session, cursor: result.nextCursor } : request.current), cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.code === 'search_quota_exhausted') { setExhausted(true); setReleases(data.quota?.releasesAt); }
        if (data.error?.code === 'search_expired') request.current = null;
        throw new Error(data.error?.message ?? '搜索失败，请重试');
      }
      setResult(more && result ? { ...data, results: [...result.results, ...data.results] } : data);
    } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '搜索失败，请重试'); }
    finally { pending.current = false; setBusy(false); }
  }
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) active.current?.abort();
  }
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><Button variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label="全站搜索"><Search className="size-5" aria-hidden="true" /></Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content className="fixed inset-x-3 top-[5dvh] z-50 mx-auto flex max-h-[90dvh] max-w-2xl flex-col rounded-xl border border-border bg-background p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between"><Dialog.Title className="text-xl font-semibold">全站搜索</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="关闭搜索"><X /></Button></Dialog.Close></div>
        <Dialog.Description className="mt-2 text-sm text-muted-foreground">精确匹配连续原文，区分大小写、空格与标点。正文查询需含至少三个连续文字或数字；较短查询只搜索标题和描述。</Dialog.Description>
        <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); void submit(); }}><input aria-label="搜索原文" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3" placeholder="输入连续原文" /><Button disabled={busy || !query.trim()} type="submit">{busy ? '搜索中…' : '搜索'}</Button></form>
        <div className="mt-4 overflow-y-auto" aria-busy={busy} aria-live="polite">
          {error && <p role="alert" className="py-3">{error}{!exhausted && <button className="ml-2 underline" disabled={busy} onClick={() => void submit()}>重试</button>}</p>}
          {exhausted && <div className="pb-4"><p className="text-sm text-muted-foreground">{releases && `恢复时间：${new Date(releases).toLocaleTimeString()}`}</p><Link prefetch={false} href="/redeem" className="mt-2 inline-block underline" onClick={() => changeOpen(false)}>开通订阅，解锁无限搜索</Link></div>}
          {result && <><p className="text-sm text-muted-foreground">{result.quota.remaining === null ? '订阅用户：无限搜索' : `本小时剩余 ${result.quota.remaining} 次搜索`}{!result.bodySearch && ' · 本次只搜索标题与描述'}</p>
            {!result.results.length && <p className="py-8 text-center">没有找到匹配内容</p>}
            {result.results.map(item => <article key={item.id} className="border-b border-border py-4">
              <Link prefetch={false} href={`/p/${item.slug}`} onClick={() => changeOpen(false)} className="font-semibold hover:underline"><Highlight text={item.title || '帖子'} query={result.query} /></Link>
              <p className="mt-1 text-xs text-muted-foreground">{item.visibility === 'paid' ? '付费' : '免费'} · {item.publishedAt?.slice(0,10)}</p>
              {item.description && <p className="mt-2 text-sm"><Highlight text={item.description} query={result.query} /></p>}
              {item.hits?.map(hit => <Link prefetch={false} key={hit.start} onClick={() => changeOpen(false)} href={`/p/${item.slug}#search=${result.session}&revision=${item.revision}&start=${hit.start}`} className="mt-2 block rounded border border-border whitespace-pre-wrap p-2 text-sm hover:bg-muted"><Highlight text={hit.context} query={result.query} /><span className="ml-2 text-xs text-muted-foreground">定位原文 →</span></Link>)}
              {item.visibility === 'paid' && !item.canAccess && <Link prefetch={false} href="/redeem" onClick={() => changeOpen(false)} className="mt-2 inline-block text-sm underline">开通订阅，查看正文命中位置</Link>}
            </article>)}
            {result.nextCursor !== null && <Button variant="outline" className="my-4 w-full" disabled={busy} onClick={() => void submit(true)}>加载更多</Button>}
          </>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
