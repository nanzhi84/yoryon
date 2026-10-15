import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = { title: "重置密码", robots: noIndex };

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-5">
        <h1 className="mb-4 text-2xl font-semibold">重置密码</h1>
        <ResetPasswordForm />
      </main>
    </>
  );
}
