"use client";

import { createContext, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsDisabled, trackOnce } from "@/lib/analytics";

export type CollectionFlow = {
  id: string; collectionId: string; slug: string; elapsed: number; sent: boolean; navigating: boolean;
};
const FlowContext = createContext<MutableRefObject<CollectionFlow | null> | null>(null);

export function CollectionFlowProvider({ children }: { children: ReactNode }) {
  const flow = useRef<CollectionFlow | null>(null);
  useEffect(() => {
    function departure(event: MouseEvent) {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.href !== location.href && flow.current) flow.current.navigating = true;
    }
    const pop = () => { if (flow.current) flow.current.navigating = true; };
    document.addEventListener("click", departure, true);
    window.addEventListener("popstate", pop);
    return () => { document.removeEventListener("click", departure, true); window.removeEventListener("popstate", pop); };
  }, []);
  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}

export function useCollectionFlow() {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error("CollectionFlowProvider is required");
  return flow;
}

/** Root route observer discards a process when the reader leaves its navigation chain. */
export function CollectionFlowRoute() {
  const flow = useCollectionFlow();
  const pathname = usePathname();
  const search = useSearchParams();
  const slug = search.get("collection"), flowId = search.get("flow");
  useEffect(() => {
    const current = flow.current;
    if (!current) return;
    const inDirectory = pathname === `/c/${current.slug}`;
    const inChapter = pathname.startsWith("/p/") && slug === current.slug && flowId === current.id;
    if (!inDirectory && !inChapter) flow.current = null;
  }, [pathname, slug, flowId, flow]);
  return null;
}

export function chapterHref(slug: string, collectionSlug: string, flowId: string | null): string {
  const query = new URLSearchParams({ collection: collectionSlug });
  if (flowId) query.set("flow", flowId);
  return `/p/${slug}?${query}`;
}

/** Only mounted, eligible surfaces contribute; navigation and background time are excluded. */
export function useCollectionTime(flowId: string | null, eligible: boolean) {
  const holder = useCollectionFlow();
  useEffect(() => {
    const flow = holder.current;
    if (!eligible || !flow || flow.id !== flowId) return;
    flow.navigating = false;
    let since = performance.now();
    let visible = document.visibilityState === "visible";
    const accrue = () => {
      const now = performance.now();
      if (visible && !flow.navigating && holder.current === flow) flow.elapsed += now - since;
      since = now;
      if (flow.elapsed >= 10_000 && !flow.sent && !analyticsDisabled()) {
        flow.sent = true;
        trackOnce(`collection-read:${flow.id}`, { eventType: "read", targetKind: "collection", targetId: flow.collectionId, pageViewId: flow.id });
      }
    };
    const visibility = () => { accrue(); visible = document.visibilityState === "visible"; };
    const interval = window.setInterval(accrue, 100);
    document.addEventListener("visibilitychange", visibility);
    return () => { accrue(); clearInterval(interval); document.removeEventListener("visibilitychange", visibility); };
  }, [holder, flowId, eligible]);
}
