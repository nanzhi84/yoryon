import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "重置密码" };

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
