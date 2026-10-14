"use client";
import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useBrowseNavigation } from "./browse-navigation";
import { BROWSE_LAYOUT_READY, currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";

export const BROWSE_RETURNED = "yoryon:browse-returned";

export function NavigationMemory() {
  const { live, restoreNow } = useBrowseNavigation();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useLayoutEffect(() => {
    const path = pathname + (search ? `?${search}` : "");
    live.current = { path, y: scrollY, leaving: false, restoring: false };
    let frame = 0;
    let timer = 0;
    let locatePending = () => {};
    function restore() {
      if (currentBrowsePath() !== path || live.current.restoring) return;
      if (readBrowse<{ path: string }>("restore")?.path !== path) return;
      const position = readBrowse<Record<string, { y: number }>>("positions")?.[path];
      if (!position || !Number.isFinite(position.y) || position.y < 0) { writeBrowse("restore", null); return; }
      live.current.restoring = true; live.current.leaving = false;
      const deadline = performance.now() + 8000;
      timer = window.setTimeout(() => window.dispatchEvent(new Event(BROWSE_RETURNED)), 0);
      function locate() {
        if (currentBrowsePath() !== path || !live.current.restoring) return;
        const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const ready = !document.querySelector('[data-browse-ready="false"]');
        if ((ready && maximum >= position!.y - 2) || performance.now() >= deadline) {
          cancelAnimationFrame(frame);
          window.scrollTo({ top: Math.min(position!.y, maximum), behavior: "instant" });
          live.current.restoring = false; live.current.y = scrollY;
          writeBrowse("restore", null); locatePending = () => {};
        } else frame = requestAnimationFrame(locate);
      }
      locatePending = locate; locate();
    }
    function layoutReady() { if (live.current.restoring) { cancelAnimationFrame(frame); locatePending(); } }
    restoreNow.current = restore;
    window.addEventListener(BROWSE_LAYOUT_READY, layoutReady);
    restore();
    return () => {
      cancelAnimationFrame(frame); clearTimeout(timer);
      restoreNow.current = () => {};
      window.removeEventListener(BROWSE_LAYOUT_READY, layoutReady);
    };
  }, [pathname, search, live, restoreNow]);
  return null;
}
