import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RedeemClient } from "@/components/redeem-client";

export const metadata: Metadata = { title: "兑换激活码" };

export default function RedeemPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-12">
        <h1 className="text-2xl font-semibold">兑换激活码</h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          标准订阅 ¥29.9/月，兑换后立即解锁全部付费内容；到期自动失效。
        </p>
        <RedeemClient />
      </main>
    </>
  );
}
