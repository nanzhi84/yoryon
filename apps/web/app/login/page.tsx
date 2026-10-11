import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm py-12">
        <h1 className="mb-6 text-2xl font-semibold">登录</h1>
        <LoginForm />
      </main>
    </>
  );
}
