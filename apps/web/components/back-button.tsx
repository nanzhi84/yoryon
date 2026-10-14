"use client";
import { ArrowLeft } from "lucide-react";
import { writeBrowse } from "@/lib/browse-memory";
import { safeReturnTo } from "@/lib/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  function back() {
    const origin = history.state?.yoryonReturn as { path: string; time: number } | undefined;
    const path = safeReturnTo(origin?.path);
    if (path && origin && Date.now() - origin.time < 7_200_000 && history.length > 1) {
      writeBrowse("restore", { path }); history.back();
    } else { window.location.assign(safeReturnTo(fallback) ?? "/"); }
  }
  return <button type="button" onClick={back} className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-sm text-[13px] leading-5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="返回上一页">
    <ArrowLeft className="size-4" aria-hidden="true" />返回
  </button>;
}
