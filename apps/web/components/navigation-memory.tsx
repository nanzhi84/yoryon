"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { currentBrowsePath, readBrowse, rememberPosition, writeBrowse } from "@/lib/browse-memory";

export const BROWSE_RETURNED = "yoryon:browse-returned";
/** 记录真实离开入口；返回等待追加列表恢复高度后再定位，不将history替换成另一页面。 */
export function NavigationMemory() {
  const pathname = usePathname();
  useEffect(() => {
    let frame = 0; let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = readBrowse<{ to: string; path: string; time: number }>("pending-return");
    if (pending?.to === currentBrowsePath() && Date.now() - pending.time < 10_000) {
      // 合并保留Next内部history字段；只把真实点击来源绑定到本次history entry。
      history.replaceState({ ...history.state, yoryonReturn: { path: pending.path, time: pending.time } }, "");
      writeBrowse("pending-return", null);
    }
    function restore() {
      if (location.pathname !== pathname) return;
      const path = currentBrowsePath();
      const requested = readBrowse<{ path: string }>("restore");
      if (requested?.path !== path) return;
      const position = readBrowse<Record<string, { y: number; time: number }>>("positions")?.[path];
      writeBrowse("restore", null);
      window.dispatchEvent(new Event(BROWSE_RETURNED));
      if (!position || !Number.isFinite(position.y) || position.y < 0) return;
      const deadline = performance.now() + 8000;
      let settled = 0;
      function locate() {
        if (currentBrowsePath() !== path) return;
        const maximum = document.documentElement.scrollHeight - innerHeight;
        if (maximum >= position!.y - 4 || performance.now() >= deadline) {
          window.scrollTo({ top: Math.min(position!.y, Math.max(0, maximum)), behavior: "auto" });
          if (++settled >= 3) return;
        }
        frame = requestAnimationFrame(locate);
      }
      frame = requestAnimationFrame(locate);
    }
    function click(event: MouseEvent) {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === currentBrowsePath()) return;
      rememberPosition();
      writeBrowse("pending-return", { to: url.pathname + url.search, path: currentBrowsePath(), time: Date.now() });
    }
    function scroll() { if (timer) clearTimeout(timer); timer = setTimeout(rememberPosition, 150); }
    function pop() { writeBrowse("restore", { path: currentBrowsePath() }); restore(); }
    function show(event: PageTransitionEvent) { if (event.persisted) restore(); }
    restore();
    document.addEventListener("click", click, true);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", rememberPosition);
    window.addEventListener("popstate", pop);
    window.addEventListener("pageshow", show);
    return () => { cancelAnimationFrame(frame); if (timer) clearTimeout(timer); document.removeEventListener("click", click, true);
      window.removeEventListener("scroll", scroll); window.removeEventListener("pagehide", rememberPosition); window.removeEventListener("popstate", pop); window.removeEventListener("pageshow", show); };
  }, [pathname]);
  return null;
}
