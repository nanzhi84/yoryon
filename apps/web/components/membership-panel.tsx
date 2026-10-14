"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, CircleHelp, MessagesSquare } from "lucide-react";
import type { Membership } from "@/lib/types";
import { MemberQuestions } from "./member-questions";
import { Button } from "./ui/button";
import { readBrowse, writeBrowse } from "@/lib/browse-memory";
import { NOTIFICATIONS_CHANGED } from "@/lib/notification-events";

export function MembershipPanel({ initial, authenticated, unavailable = false, works }: { initial: Membership | null; authenticated: boolean; unavailable?: boolean; works: React.ReactNode }) {
  const [logged, setLogged] = useState(authenticated);
  const [membership, setMembership] = useState(initial);
  const [error, setError] = useState(unavailable);
  const [tab, setTab] = useState<"works" | "questions">("works");
  const [questionOpened, setQuestionOpened] = useState(false);
  useEffect(() => { if (readBrowse<string>("subscription-tab") === "questions") { setTab("questions"); setQuestionOpened(true); } }, []);
  function choose(next: "works" | "questions") { setTab(next); if (next === "questions") setQuestionOpened(true); writeBrowse("subscription-tab", next); }
  const membershipRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    membershipRequest.current?.abort(); const controller = new AbortController(); membershipRequest.current = controller;
    try {
      const res = await fetch("/api/me/membership", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (controller.signal.aborted) return;
      if (res.status === 401) { setLogged(false); setMembership(null); setError(false); return; }
      if (!res.ok) throw new Error(String(res.status));
      setLogged(true); setMembership(await res.json() as Membership); setError(false);
    } catch { if (!controller.signal.aborted) setError(true); }
  }, []);
  useEffect(() => {
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    const show = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    window.addEventListener("focus", focus); window.addEventListener("pageshow", show); window.addEventListener(NOTIFICATIONS_CHANGED, focus);
    return () => { membershipRequest.current?.abort(); window.removeEventListener("focus", focus); window.removeEventListener("pageshow", show); window.removeEventListener(NOTIFICATIONS_CHANGED, focus); };
  }, [refresh]);
  return <>
    <section id="membership" className="mb-7" aria-label="会员状态">
      {error ? <>
        <h1 className="text-lg font-semibold leading-[26px]">会员状态</h1>
        <p role="alert" className="mt-3 text-sm">会员状态加载失败。<button className="ml-2 min-h-11 text-primary underline underline-offset-4" onClick={() => void refresh()}>重试</button></p>
      </> : membership?.active ? <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold leading-[26px]">我的会员</h1>
          <span className="text-sm text-primary">已开通</span>
        </div>
        <p className="mt-3 text-sm leading-[23px] text-muted-foreground">{membership.permanent ? "长期有效" : `到期时间：${new Date(membership.validUntil!).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`}</p>
        <p className="mt-2 text-sm leading-[23px]">本月剩余提问次数：{membership.questionsRemaining ?? 0} 次</p>
      </> : <>
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
          <h1 className="text-lg font-semibold leading-[26px]">支持我的持续创作</h1>
          <p className="shrink-0 whitespace-nowrap text-sm"><span className="text-xl font-semibold">¥29.9</span> / 月</p>
        </div>
        <ul aria-label="会员权益" className="mt-4 grid grid-cols-3 gap-4">
          <li className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium leading-5"><BookOpen className="size-[18px] shrink-0 text-primary" aria-hidden="true" />专属作品</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">解锁全部付费内容</p>
          </li>
          <li className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium leading-5"><CircleHelp className="size-[18px] shrink-0 text-primary" aria-hidden="true" />每月提问</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">每个自然月 1 次</p>
          </li>
          <li className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium leading-5"><MessagesSquare className="size-[18px] shrink-0 text-primary" aria-hidden="true" />会员讨论</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">阅读回答，参与讨论</p>
          </li>
        </ul>
        <div className="mt-5">
          <Button asChild className="min-h-11 rounded-md px-5 text-sm">
            <Link href="/redeem?returnTo=%2Fsubscription%23membership" prefetch={false}>兑换激活码，开通会员</Link>
          </Button>
        </div>
      </>}
    </section>
    <div role="tablist" aria-label="订阅内容" className="mb-4 flex gap-7 border-b border-border">
      {(["works", "questions"] as const).map(value => <button key={value} type="button" id={`subscription-${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`subscription-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => choose(value)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "works" : event.key === "End" ? "questions" : value === "works" ? "questions" : "works"; choose(next); document.getElementById(`subscription-${next}-tab`)?.focus(); } }}
        className={`min-h-11 border-b-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === value ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>{value === "works" ? "会员作品" : "会员问答"}</button>)}
    </div>
    <div id="subscription-works-panel" role="tabpanel" aria-labelledby="subscription-works-tab" hidden={tab !== "works"}>{works}</div>
    <div id="subscription-questions-panel" role="tabpanel" aria-labelledby="subscription-questions-tab" hidden={tab !== "questions"}>
      {questionOpened && <MemberQuestions active={!!membership?.active} remaining={membership?.questionsRemaining ?? 0} authenticated={logged} onAsked={refresh} />}
    </div>
  </>;
}
