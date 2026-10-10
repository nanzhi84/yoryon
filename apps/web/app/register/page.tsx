import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "注册" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm py-12">
        <h1 className="mb-6 text-2xl font-semibold">注册</h1>
        <RegisterForm />
      </main>
    </>
  );
}
