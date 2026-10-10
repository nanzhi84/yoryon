"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return (
    <main className="py-24 text-center">
      <h1 className="text-2xl font-semibold">出错了</h1>
      <p className="mt-3 text-muted-foreground">页面加载失败，请稍后重试。</p>
      <Button className="mt-6" onClick={reset}>重试</Button>
    </main>
  );
}
