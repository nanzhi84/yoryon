"use client";
import { backControlClassName } from "./back-link";
import { ArrowLeft } from "lucide-react";
import { useBrowseOrigins } from "./browse-navigation";
import { currentBrowsePath, writeBrowse } from "@/lib/browse-memory";
import { safeReturnTo } from "@/lib/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const origins = useBrowseOrigins();
  function back() {
    const origin = origins?.get(currentBrowsePath());
    const path = safeReturnTo(origin?.path);
    if (path && origin && Date.now() - origin.time < 7_200_000 && history.length > 1) {
      writeBrowse("restore", { path }); history.back();
    } else { window.location.assign(safeReturnTo(fallback) ?? "/"); }
  }
  return <button type="button" onClick={back} className={backControlClassName} aria-label="返回上一页">
    <ArrowLeft className="size-4" aria-hidden="true" />返回
  </button>;
}
