"use client";
import { useState } from "react";
import Link from "next/link";
import type { Membership } from "@/lib/types";
import { MemberQuestions } from "./member-questions";

export function MembershipPanel({ initial, authenticated, unavailable = false }: { initial: Membership | null; authenticated: boolean; unavailable?: boolean }) {
  const [membership, setMembership] = useState(initial);
  const [error, setError] = useState(unavailable);
  async function refresh() {
    try {
      const res = await fetch("/api/me/membership", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setMembership(await res.json() as Membership); setError(false);
    } catch { setError(true); }
  }
  return <>
    <section id="membership" className="mb-12 rounded-lg bg-muted/50 px-6 py-7" aria-label="会员状态">
      {error ? <p role="alert">会员状态加载失败。<button className="underline" onClick={() => void refresh()}>重试</button></p>
        : membership?.active ? <><h1 className="text-2xl font-semibold">我的会员</h1>
          <p className="mt-3 text-sm">{membership.permanent ? "长期有效" : `到期时间：${new Date(membership.validUntil!).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`}</p>
          <p className="mt-2 text-sm">本月剩余提问次数：{membership.questionsRemaining ?? 0} 次</p></>
        : <><h1 className="text-2xl font-semibold">支持我的持续创作</h1><p className="mt-3 text-sm text-muted-foreground">¥29.9/月。每月一次会员问答，阅读专属作品，参与会员讨论。</p>
          <Link href="/redeem?returnTo=%2Fsubscription%23membership" prefetch={false} className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">兑换激活码，开通会员</Link>
          <p className="mt-2 text-xs text-muted-foreground">使用已有激活码兑换会员权益。</p></>}
    </section>
    <MemberQuestions active={!!membership?.active} remaining={membership?.questionsRemaining ?? 0} authenticated={authenticated} onAsked={refresh} />
  </>;
}
