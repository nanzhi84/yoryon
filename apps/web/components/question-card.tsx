"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { QuestionItem } from "@/lib/types";
import { Avatar } from "./avatar";
export function QuestionCard({ item, onPrivacyChanged }: { item: QuestionItem; onPrivacyChanged?: () => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState(item);
  useEffect(() => setQuestion(item), [item]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function togglePrivacy() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility: question.visibility === "private" ? "public" : "private" }) });
      const data = await res.json() as { item?: QuestionItem; error?: { message?: string } };
      if (!res.ok || !data.item) throw new Error(data.error?.message ?? "隐私修改失败");
      setQuestion(data.item); if (onPrivacyChanged) onPrivacyChanged(); else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "网络错误，请重试"); } finally { setBusy(false); }
  }
  return <article id={`question-${question.id}`} className="space-y-3 py-6">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Avatar author={question.author} /><span className="font-medium text-foreground">{question.author.displayName ?? question.author.username}</span>
      <time>{new Date(question.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</time>
      <span>{question.status === "pending" ? "待回答" : question.status === "hidden" ? "已隐藏" : "已回答"}</span>
      {question.visibility === "private" && <span>私密</span>}
    </div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{question.question}</p>
    {question.answer ? <div className="border-l-2 pl-4"><p className="mb-1 text-xs font-medium">创作者回答</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{question.answer}</p></div>
      : question.answerLocked ? <p className="text-sm text-muted-foreground">回答仅会员可见。<Link href="/redeem?returnTo=%2Fsubscription" className="underline">兑换会员权益</Link></p>
      : question.status === "pending" ? <p className="text-sm text-muted-foreground">创作者尚未回答。</p> : null}
    <div className="flex gap-4 text-xs text-muted-foreground">
      <Link href={`/questions/${question.id}`} prefetch={false} className="underline">{question.canDiscuss ? "查看讨论" : "查看问答"}</Link>
      {question.own && question.status !== "hidden" && <button type="button" disabled={busy} onClick={() => void togglePrivacy()} className="underline">{busy ? "修改中…" : question.visibility === "private" ? "设为公开" : "设为私密"}</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </article>;
}
