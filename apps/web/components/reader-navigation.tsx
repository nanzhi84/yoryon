"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { readerLayoutSchema, type ReaderLayout } from "@yoryon/config/reader-layout";
import { TrackClickLink } from "./analytics";
import type { FeedContentItem } from "@/lib/types";

type Hint = { slug: string; title: string; publishedAt: string | null; layout: ReaderLayout };
const ReaderContext = createContext<{ hint: Hint | null; setHint: (hint: Hint) => void }>({ hint: null, setHint: () => {} });

export function ReaderNavigationProvider({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState<Hint | null>(null);
  const pathname = usePathname();
  useEffect(() => { if (!pathname.startsWith("/p/")) setHint(null); }, [pathname]);
  return <ReaderContext.Provider value={{ hint, setHint }}>{children}</ReaderContext.Provider>;
}

export function useReaderHint() {
  const { hint } = useContext(ReaderContext);
  const pathname = usePathname();
  return hint && pathname === `/p/${hint.slug}` ? hint : null;
}

export function ReaderLink({ item, className, children }: { item: FeedContentItem; className?: string; children: ReactNode }) {
  const { setHint } = useContext(ReaderContext);
  return <TrackClickLink prefetchShell targetKind="work" targetId={item.id} href={`/p/${item.slug}`} className={className ?? ""}
    onNavigate={() => {
      const result = readerLayoutSchema.safeParse(item.readerLayout);
      setHint({ slug: item.slug, title: item.title, publishedAt: item.publishedAt, layout: result.success ? result.data : [] });
    }}>{children}</TrackClickLink>;
}
