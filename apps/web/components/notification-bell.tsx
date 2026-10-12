"use client";

/** 站内通知入口（Issue #14）：未读角标；仅登录用户可见；未登录不渲染。 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return; // 401 未登录等：不渲染入口
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        /* 通知角标失败不影响导航 */
      }
    }
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (count === null) return null;
  return (
    <Link prefetch={false} href="/notifications" className="relative rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground" aria-label={count > 0 ? `通知（${count} 条未读）` : "通知"}>
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
