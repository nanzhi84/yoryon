import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-5">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Yoryon
      </Link>
      <nav className="flex items-center gap-1">
        <Link href="/redeem" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          兑换
        </Link>
        <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          登录
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
