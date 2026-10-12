import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-5">
      <Link prefetch={false} href="/" className="text-lg font-semibold tracking-tight">
        Yoryon
      </Link>
      <nav className="flex items-center gap-1">
        <Link prefetch={false} href="/about" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          关于
        </Link>
        <Link prefetch={false} href="/c" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          合集
        </Link>
        <Link prefetch={false} href="/redeem" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          订阅
        </Link>
        <NotificationBell />
        <Link prefetch={false} href="/login" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          登录
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
