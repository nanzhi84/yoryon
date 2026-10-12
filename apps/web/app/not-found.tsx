import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="py-24 text-center">
        <h1 className="text-4xl font-semibold">404</h1>
        <p className="mt-3 text-muted-foreground">页面不存在。</p>
        <Link prefetch={false} href="/" className="mt-6 inline-block underline underline-offset-4">回到首页</Link>
      </main>
    </>
  );
}
