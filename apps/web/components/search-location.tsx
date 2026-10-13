"use client";
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
type Hit = { start: number; end: number; nodes: { id: string; start: number; end: number }[] };
/** Location tokens live only in fragments, never in analytics/query strings.
 * Server returns ranges only after current canAccess + revision checks.
 */
export function SearchLocation({ slug }: { slug: string }) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [index, setIndex] = useState(0);
  const [nextAfter, setNextAfter] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<{ session: string; revision: string; start: number } | null>(null);
  useEffect(() => {
    const load = () => {
      const p = new URLSearchParams(location.hash.slice(1));
      const session = p.get('search'); const revision = p.get('revision');
      if (session && revision) setTarget({ session, revision, start: Number(p.get('start') ?? 0) });
      else { setTarget(null); setHits([]); }
    };
    load(); window.addEventListener('hashchange',load);
    return () => window.removeEventListener('hashchange',load);
  }, []);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setBusy(true); setError(''); setHits([]);
    fetch('/api/search/locate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({session:target.session,slug,revision:target.revision,after:target.start}), cache:'no-store', signal:controller.signal })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error?.message ?? '定位失败'); setHits(data.hits); setNextAfter(data.nextAfter); setIndex(0); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [target,slug,attempt]);
  useEffect(() => {
    const hit = hits[index]; if (!target || !hit) return;
    let painted = false;
    function paint() {
      const body = document.querySelector(`[data-search-content="${slug}"]`);
      if (!body || body.getAttribute('data-search-revision') !== target!.revision) return;
      const roots = body.querySelectorAll('[data-search-body]');
      if (roots.length !== 1) return;
      const ranges: Range[] = [];
      for (const n of hit!.nodes) {
        const element = roots[0]!.querySelector(`[data-search-node="${n.id}"]`);
        if (!element) return;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let offset = 0; let first: Text | null = null; let last: Text | null = null; let from = 0; let to = 0;
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const end = offset + node.length;
          if (!first && n.start >= offset && n.start < end) { first = node; from = n.start-offset; }
          if (n.end > offset && n.end <= end) { last = node; to = n.end-offset; break; }
          offset = end;
        }
        if (!first || !last) return;
        const range = document.createRange(); range.setStart(first,from); range.setEnd(last,to); ranges.push(range);
      }
      // CSS Highlights preserves the original DOM and syntax-highlight tokens.
      const highlights = (CSS as any).highlights;
      const HighlightClass = (window as any).Highlight;
      if (!highlights || !HighlightClass) { setError('当前浏览器不支持字符高亮，请使用较新的浏览器'); return; }
      highlights.set('search-hit', new HighlightClass(...ranges));
      roots[0]!.querySelector(`[data-search-node="${hit!.nodes[0]?.id}"]`)?.scrollIntoView({block:'center'});
      painted = true;
    }
    paint();
    const observer = new MutationObserver(() => { if (!painted) paint(); });
    const timeout = setTimeout(() => { if (!painted) setError('正文尚未就绪或版本已更新，请重试定位'); }, 8000);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-search-revision']});
    return () => { clearTimeout(timeout); observer.disconnect(); (CSS as any).highlights?.delete('search-hit'); };
  },[hits,index,target,slug]);
  if (!target) return null;
  return <aside className="sticky top-2 z-20 my-4 rounded-md border border-border bg-background p-3 text-sm" aria-live="polite">
    {busy ? '正在定位搜索命中…' : error ? <span role="alert">{error} <button className="underline" onClick={() => setAttempt(n=>n+1)}>重试</button></span> : hits.length ? <div className="flex flex-wrap items-center gap-2"><span>正文命中 {index+1} / {hits.length}{nextAfter!==null ? '+' : ''}</span><Button size="sm" variant="outline" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>上一处</Button><Button size="sm" variant="outline" disabled={index===hits.length-1} onClick={()=>setIndex(i=>i+1)}>下一处</Button>{nextAfter!==null && <Button size="sm" variant="outline" onClick={()=>setTarget({...target,start:nextAfter})}>后续命中</Button>}<Button size="sm" variant="ghost" onClick={()=>setTarget({...target,start:0})}>从首处开始</Button></div> : '当前正文没有可定位命中'}
  </aside>;
}
