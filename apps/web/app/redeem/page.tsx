import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RedeemClient } from "@/components/redeem-client";

export const metadata: Metadata = { title: "兑换激活码" };
export const dynamic = "force-dynamic";

export default function RedeemPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl py-12">
        <h1 className="mb-6 text-2xl font-semibold">兑换激活码</h1>
        <RedeemClient />
      </main>
    </>
  );
}
