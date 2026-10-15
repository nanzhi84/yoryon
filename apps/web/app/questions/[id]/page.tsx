import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { apiFetch } from "@/lib/api";
import type { QuestionItem } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { QuestionCard } from "@/components/question-card";
import { CommentSection } from "@/components/comment-section";
export const dynamic = "force-dynamic";
export const metadata = { title: "会员问答", robots: { index: false, follow: false } };
export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiFetch(`/api/questions/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`question API ${res.status}`);
  const { item } = await res.json() as { item: QuestionItem };
  return <><SiteHeader /><main className="py-5"><BackLink href="/subscription">返回订阅</BackLink><QuestionCard item={item} />
    {item.canDiscuss && <CommentSection slug="" questionId={id} />}
  </main></>;
}
