import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "重置密码" };

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm py-12">
        <h1 className="mb-6 text-2xl font-semibold">重置密码</h1>
        <ResetPasswordForm />
      </main>
    </>
  );
}
