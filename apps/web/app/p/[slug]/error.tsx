"use client";

import { SiteHeader } from "@/components/site-header";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";

export default function ErrorPage() {
  return <>
    <SiteHeader />
    <main className="editorial-reader py-5">
      <BackButton />
      <div className="py-12 text-center">
        <p role="alert" className="mb-5 text-muted-foreground">文章暂时无法加载，请稍后重试。</p>
        {/* A fresh request also clears a failed streamed metadata/RSC tree. */}
        <Button onClick={() => window.location.reload()}>重试</Button>
      </div>
    </main>
  </>;
}
