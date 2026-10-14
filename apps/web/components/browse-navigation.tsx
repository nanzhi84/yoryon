"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode, type MutableRefObject } from "react";
import { currentBrowsePath, rememberPosition, writeBrowse } from "@/lib/browse-memory";

type Origin = { path: string; time: number };
type BrowseNavigation = {
  origins: Map<string, Origin>;
  live: MutableRefObject<{ path: string; y: number; leaving: boolean; restoring: boolean }>;
  restoreNow: MutableRefObject<() => void>;
};
const BrowseNavigationContext = createContext<BrowseNavigation | null>(null);

/** Root-owned listeners stay mounted outside all route and search-parameter Suspense boundaries. */
export function BrowseNavigationProvider({ children }: { children: ReactNode }) {
  const live = useRef({ path: "", y: 0, leaving: false, restoring: false });
  const restoreNow = useRef(() => {});
  const value = useRef<BrowseNavigation>({ origins: new Map(), live, restoreNow });
  const origins = value.current.origins;
  // Keep navigation listeners alive across Suspense/streaming commits. Layout effects
  // can be disconnected while a cached route is hidden, including before popstate.
  useEffect(() => {
    const previous = history.scrollRestoration;
    let ownsScroll = false;
    try {
      sessionStorage.setItem("yoryon:browse:probe", "1"); sessionStorage.removeItem("yoryon:browse:probe");
      history.scrollRestoration = "manual"; ownsScroll = true;
    } catch { /* Use the browser's policy when optional storage is unavailable. */ }
    let saveFrame = 0;
    function save() {
      const state = live.current;
      if (!state.leaving && !state.restoring && currentBrowsePath() === state.path) rememberPosition(state.path, state.y);
    }
    function scroll() {
      const state = live.current;
      if (state.leaving || state.restoring || currentBrowsePath() !== state.path) return;
      state.y = scrollY;
      cancelAnimationFrame(saveFrame); saveFrame = requestAnimationFrame(save);
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      const destination = url.pathname + url.search;
      const state = live.current;
      if (url.origin !== location.origin || destination === state.path) return;
      state.y = scrollY; save(); state.leaving = true;
      origins?.delete(destination); origins?.set(destination, { path: state.path, time: Date.now() });
      if (origins && origins.size > 40) origins.delete(origins.keys().next().value!);
    }
    function pop() {
      const state = live.current;
      if (!state.restoring && !state.leaving) rememberPosition(state.path, state.y);
      state.leaving = true;
      cancelAnimationFrame(saveFrame);
      window.scrollTo({ top: scrollY, behavior: "instant" });
      writeBrowse("restore", { path: currentBrowsePath() });
      restoreNow.current();
    }
    function interrupt() {
      if (!live.current.restoring) return;
      live.current.restoring = false; live.current.y = scrollY;
      writeBrowse("restore", null);
    }
    document.addEventListener("click", click, true);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", save);
    window.addEventListener("popstate", pop, true);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    return () => {
      cancelAnimationFrame(saveFrame);
      if (ownsScroll) history.scrollRestoration = previous;
      document.removeEventListener("click", click, true);
      window.removeEventListener("scroll", scroll); window.removeEventListener("pagehide", save);
      window.removeEventListener("popstate", pop, true); window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
    };
  }, [origins]);

  return <BrowseNavigationContext.Provider value={value.current}>{children}</BrowseNavigationContext.Provider>;
}
export function useBrowseNavigation() {
  const context = useContext(BrowseNavigationContext);
  if (!context) throw new Error("BrowseNavigationProvider is required");
  return context;
}
export function useBrowseOrigins() { return useBrowseNavigation().origins; }
