"use client";

/** 通知入口常驻；仅登录用户展示未读角标，匿名访问由通知页引导登录。 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { NOTIFICATIONS_CHANGED } from "@/lib/notification-events";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let request = 0;
    let controller: AbortController | null = null;
    async function load() {
      const current = ++request;
      controller?.abort();
      const active = new AbortController();
      controller = active;
      const timer = setTimeout(() => active.abort(), 15_000);
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store", credentials: "same-origin", signal: active.signal });
        if (cancelled || current !== request) return;
        if (res.status === 401) { setCount(null); return; }
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled && current === request && Number.isInteger(data.count) && data.count >= 0) setCount(data.count);
      } catch {
        /* 通知角标失败不影响导航 */
      } finally {
        clearTimeout(timer);
      }
    }
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, onFocus);
    return () => {
      cancelled = true;
      controller?.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onFocus);
    };
  }, [pathname]);

  return (
    <Link prefetch={false} href="/notifications" className="relative flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20" aria-label={count !== null && count > 0 ? `通知（${count} 条未读）` : "通知"}>
      <Bell className="size-5" aria-hidden="true" />
      {count !== null && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
