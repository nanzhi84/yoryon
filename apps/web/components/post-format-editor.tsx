"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarkdownSurface } from "./markdown-surface";
import type { FormatPost } from "@/lib/post-format-types";

type Draft = FormatPost & { saved: string; error: string | null; saving: boolean };
function SourceInput({ draft, change }: { draft: Draft; change: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${Math.max(160, ref.current.scrollHeight)}px`; }
  }, [draft.markdown]);
  return <textarea ref={ref} aria-label={`${draft.date} ${draft.slug} 原文`} spellCheck={false} value={draft.markdown}
    onChange={event => change(event.target.value)} className="block min-h-40 w-full resize-y rounded-lg border border-border bg-background p-4 font-mono text-sm leading-7 outline-none focus:ring-2 focus:ring-primary/40" />;
}
export function PostFormatEditor({ initial }: { initial: FormatPost[] }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => initial.map(item => ({ ...item, saved: item.markdown, error: null, saving: false })));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(false);
  const current = useRef(drafts); current.current = drafts;
  const dirty = drafts.filter(item => item.markdown !== item.saved).length;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (current.current.some(item => item.markdown !== item.saved)) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function change(slug: string, markdown: string) {
    setNotice("");
    setDrafts(items => items.map(item => item.slug === slug ? { ...item, markdown, error: null } : item));
  }
  async function save(slugs: string[]) {
    if (active.current) return;
    active.current = true; setBusy(true); setNotice("");
    let count = 0;
    try {
      for (const slug of slugs) {
        const draft = current.current.find(item => item.slug === slug);
        if (!draft || draft.markdown === draft.saved) continue;
        const snapshot = draft.markdown;
        setDrafts(items => items.map(item => item.slug === slug ? { ...item, saving: true, error: null } : item));
        try {
          const response = await fetch("/api/local-post-editor", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, markdown: snapshot, revision: draft.revision }), signal: AbortSignal.timeout(10_000) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "保存失败，请重试");
          if (typeof result.revision !== "string") throw new Error("保存结果无法确认，请保留文本后刷新核对");
          setDrafts(items => items.map(item => item.slug === slug ? { ...item, saved: snapshot, revision: result.revision, saving: false } : item));
          count++;
        } catch (error) {
          setDrafts(items => items.map(item => item.slug === slug ? { ...item, saving: false, error: error instanceof Error ? error.message : "保存失败" } : item));
        }
      }
      setNotice(count ? `已将 ${count} 篇修改保存到本地文件` : "没有保存成功，请查看短帖下方提示");
    } finally { active.current = false; setBusy(false); }
  }
  const visible = drafts.filter(item => `${item.date} ${item.markdown}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1380px] -translate-x-1/2 pb-16">
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 py-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="mb-1 text-xs tracking-widest text-muted-foreground">YORYON · 本地编辑</p><h1 className="text-2xl font-semibold">短帖格式整理 <span className="text-base font-normal text-muted-foreground">{drafts.length} 篇</span></h1></div>
        <button disabled={!dirty || busy} onClick={() => void save(drafts.filter(item => item.markdown !== item.saved).map(item => item.slug))}
          className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-40">{busy ? "保存中…" : dirty ? `保存全部修改（${dirty}）` : "全部已保存"}</button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">左侧调整换行与空行，右侧按网站信息流样式预览。单次回车换行；每个空行保留一整行高度，连续空行按数量显示。</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <input aria-label="搜索短帖" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文字或日期…" className="min-h-10 w-64 rounded-lg border border-border bg-background px-3 text-sm" />
        <p className="text-xs text-muted-foreground">保存到本机 Markdown 文件，不会发布到线上</p>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-primary">{notice || (dirty ? `${dirty} 篇尚未保存` : "可以开始整理")}</p>
    </header>
    {!visible.length && <p className="py-16 text-center text-muted-foreground">没有匹配的短帖</p>}
    {visible.map((draft, index) => <section key={draft.slug} aria-label={`${draft.date} 短帖`} className="border-b border-border py-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div><span className="mr-3 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><time className="font-medium">{draft.date}</time><span className="ml-3 text-xs text-muted-foreground">{draft.markdown.trim() ? draft.markdown.trim().split(/\n/).filter(line => !line.trim()).length : 0} 个段间空行</span></div>
        <button disabled={busy || draft.markdown === draft.saved} onClick={() => void save([draft.slug])} className="min-h-10 rounded-md border border-border px-4 text-sm disabled:opacity-40">{draft.saving ? "保存中…" : draft.markdown === draft.saved ? "已保存" : "保存此篇"}</button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div><h2 className="mb-2 text-xs text-muted-foreground">原文</h2><SourceInput draft={draft} change={text => change(draft.slug, text)} /></div>
        <div><h2 className="mb-2 text-xs text-muted-foreground">实时预览 · 信息流</h2><div className="rounded-lg border border-border p-4"><MarkdownSurface preserveBlankLines markdown={draft.markdown} className="prose-feed" publicImages /></div></div>
      </div>
      {draft.error && <p role="alert" className="mt-3 text-sm text-red-600">{draft.error} 输入的文本仍保留在左侧。</p>}
    </section>)}
  </main>;
}
