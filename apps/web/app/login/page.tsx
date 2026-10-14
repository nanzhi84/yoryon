import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="py-5">
        <h1 className="mb-4 text-2xl font-semibold">登录</h1>
        <LoginForm returnTo={returnTo ?? null} />
      </main>
    </>
  );
}
