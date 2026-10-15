import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RedeemClient } from "@/components/redeem-client";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = { title: "兑换激活码" };

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[600px] pb-12 pt-6 sm:pt-8">
        <div className="mb-5"><BackButton fallback={returnTo ?? "/subscription"} /></div>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-3xl">兑换激活码</h1>
        <div className="mt-5 flex items-center gap-4 text-base">
          <span>标准订阅</span>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="font-medium text-primary">¥29.9 / 月</span>
        </div>
        <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">
          兑换后即可解锁全部付费内容，到期自动失效。
        </p>
        <RedeemClient returnTo={returnTo ?? null} purchaseHint={<div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-primary/5 px-4 py-3 text-sm leading-6 sm:px-5">
          <span className="text-muted-foreground">还没有激活码？</span>
          <a
            href="https://wzyp.cn/item/ay8uxj"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            购买激活码（在新标签页打开）
          </a>
        </div>} />
      </main>
    </>
  );
}
