"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { QuestionItem, QuestionPage } from "@/lib/types";
import { Button } from "./ui/button";
import { QuestionCard } from "./question-card";
import { MessageCircle } from "lucide-react";
import { NOTIFICATIONS_CHANGED } from "@/lib/notification-events";
class QuestionRequestError extends Error {}
function requestMessage(reason: unknown) { return reason instanceof QuestionRequestError ? reason.message : "问答请求失败，请重试。"; }
export function MemberQuestions({ active, remaining, authenticated, onAsked }: { active: boolean; remaining: number; authenticated: boolean; onAsked: () => Promise<void> }) {
  const [scope, setScope] = useState<"public" | "mine">("public");
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [privateQuestion, setPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const requests = useRef<AbortController | null>(null);
  const load = useCallback(async (next: string | null, signal?: AbortSignal) => {
    if (scopeRef.current !== scope) return;
    const requestSignal = signal ?? requests.current?.signal;
    let res: Response;
    try { res = await fetch(`/api/questions/${scope}${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store", signal: requestSignal ?? null }); }
    catch (e) { if (requestSignal?.aborted) return; throw e; }
    if (requestSignal?.aborted || scopeRef.current !== scope) return;
    if (res.status === 409) { setError("问答有新活动，请刷新列表"); setCursor(null); return; }
    if (!res.ok) throw new QuestionRequestError("问答加载失败，请重试");
    const data = await res.json() as QuestionPage;
    if (requestSignal?.aborted || scopeRef.current !== scope) return;
    setItems(old => next ? [...new Map([...old, ...data.items].map(q => [q.id, q])).values()] : data.items);
    setCursor(data.nextCursor); setError(null);
  }, [scope]);
  useEffect(() => {
    const abort = new AbortController(); requests.current = abort; setItems([]); setCursor(null); setError(null); setLoading(true); setPaging(false);
    load(null, abort.signal).catch(e => { if (!abort.signal.aborted) setError(requestMessage(e)); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [load, authenticated, active]);
  useEffect(() => { if (!authenticated && scope === "mine") setScope("public"); }, [authenticated, scope]);
  useEffect(() => {
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    const show = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    window.addEventListener("focus", focus); window.addEventListener("pageshow", show); window.addEventListener(NOTIFICATIONS_CHANGED, focus);
    return () => { window.removeEventListener("focus", focus); window.removeEventListener("pageshow", show); window.removeEventListener(NOTIFICATIONS_CHANGED, focus); };
  }, [load]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return;
    setSubmitting(true); setSubmitError(null); setReceipt(null);
    try {
      const res = await fetch("/api/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: draft, visibility: privateQuestion ? "private" : "public" }) });
      const data = await res.json() as { item?: QuestionItem; error?: { message?: string } };
      if (!res.ok) throw new QuestionRequestError(data.error?.message ?? "提交失败，请重试");
      setDraft(""); setReceipt("问题已提交，等待创作者回答"); await onAsked(); await refresh();
    } catch (e) { setSubmitError(requestMessage(e)); } finally { setSubmitting(false); }
  }
  async function refresh() {
    if (scopeRef.current !== scope) return;
    requests.current?.abort(); const abort = new AbortController(); requests.current = abort;
    setLoading(true); setPaging(false); setItems([]);
    try { await load(null, abort.signal); } catch (e) { if (!abort.signal.aborted) setError(requestMessage(e)); }
    finally { if (!abort.signal.aborted) setLoading(false); }
  }
  return <section aria-label="会员问答"><h2 className="sr-only">会员问答</h2><p className="text-sm leading-[23px] text-muted-foreground">公开问题所有人可读，回答和讨论向会员开放。每个自然月可提问一次。</p>
    {active && remaining > 0 ? <form onSubmit={submit} className="mt-5 space-y-3">
      <label htmlFor="member-question" className="text-sm font-medium">向创作者提问</label>
      <textarea id="member-question" rows={3} maxLength={1000} value={draft} onChange={e => setDraft(e.target.value)} className="w-full rounded-md border bg-transparent p-3 text-sm" required />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 accent-primary" checked={privateQuestion} onChange={e => setPrivate(e.target.checked)} />私密问题（仅本人和创作者可读）</label><span className="shrink-0">{[...draft].length}/500</span></div>
      <Button disabled={submitting || [...draft.trim()].length > 500}>{submitting ? "提交中…" : "提交问题"}</Button>
    </form> : active ? <p className="mt-3 text-sm leading-[23px] text-muted-foreground">本月提问次数已用完，下个自然月恢复。</p> : !authenticated ? <p className="mt-3 text-sm leading-[23px]"><Link href="/login?returnTo=%2Fsubscription" className="text-primary underline">登录</Link> 后查看自己的历史问答。</p> : null}
    {receipt && <p role="status" className="mt-3 text-sm">{receipt}</p>}{submitError && <p role="alert" className="mt-3 text-sm text-red-500">{submitError}</p>}
    <div className="mt-6 flex gap-5 border-b border-border text-sm"><button aria-pressed={scope === "public"} className={`min-h-11 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${scope === "public" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => setScope("public")}>公开问答</button>{authenticated && <button aria-pressed={scope === "mine"} className={`min-h-11 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${scope === "mine" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => setScope("mine")}>我的问答</button>}</div>
    {loading ? <p role="status" className="py-6 text-sm text-muted-foreground">加载中…</p> : <>{error && <p role="alert" className="py-4 text-sm text-red-500">{error} <button className="underline" onClick={() => void refresh()}>刷新列表</button></p>}
      {!items.length && !error ? <div className="flex flex-col items-center gap-2.5 py-6 text-sm text-muted-foreground"><MessageCircle className="size-6 stroke-1" aria-hidden="true" /><p>{scope === "mine" ? "还没有提问记录。" : "还没有公开问答。"}</p></div> : <div className="divide-y divide-border">{items.map(q => <QuestionCard key={q.id} item={q} onPrivacyChanged={() => void refresh()} />)}</div>}
      {cursor && <Button variant="outline" disabled={paging} onClick={() => { setPaging(true); void load(cursor).catch(e => setError(requestMessage(e))).finally(() => setPaging(false)); }}>{paging ? "加载中…" : "加载更多问答"}</Button>}
    </>}
  </section>;
}
