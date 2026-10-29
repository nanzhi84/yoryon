"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { FeedContentItem } from "@/lib/types";

type Hint = Pick<FeedContentItem, "slug" | "title" | "publishedAt">;
const ReaderContext = createContext<{ hint: Hint | null; setHint: (hint: Hint) => void }>({
  hint: null,
  setHint: () => {},
});

export function ReaderNavigationProvider({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState<Hint | null>(null);
  const pathname = usePathname().replace(/\/$/, "") || "/";
  useEffect(() => {
    if (!pathname.startsWith("/p/")) setHint(null);
  }, [pathname]);
  return <ReaderContext.Provider value={{ hint, setHint }}>{children}</ReaderContext.Provider>;
}

export function useReaderHint() {
  const { hint } = useContext(ReaderContext);
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return hint && pathname === `/p/${hint.slug}` ? hint : null;
}

export function ReaderLink({
  item,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  item: Hint;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const { setHint } = useContext(ReaderContext);
  return (
    <Link
      prefetch={true}
      href={`/p/${item.slug}`}
      className={className ?? ""}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      onNavigate={() => {
        setHint(item);
      }}
    >
      {children}
    </Link>
  );
}
