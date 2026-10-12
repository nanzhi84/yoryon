import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 py-5">
      <Link prefetch={false} href="/" className="text-lg font-semibold tracking-tight">
        Yoryon
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-1">
        <Link prefetch={false} href="/" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          首页
        </Link>
        <Link prefetch={false} href="/subscription" className="rounded-md px-3 py-1.5 text-sm hover:text-foreground">
          订阅
        </Link>
        <Link prefetch={false} href="/explore" className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          探索
        </Link>
        <Link prefetch={false} href="/settings/profile" className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">资料</Link>
        <NotificationBell />
        <Link prefetch={false} href="/login" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          登录
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
