"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ThemeMenuItems } from "./theme-menu-items";
import { NotificationBell } from "./notification-bell";

export function SiteHeader() {
  const pathname = usePathname();
  const subscriptionActive = pathname === "/subscription" || pathname.startsWith("/questions/");
  const exploreActive = pathname === "/explore" || pathname === "/c" || pathname.startsWith("/c/") || pathname.startsWith("/tags/") || pathname === "/about";
  const tabClass = "relative flex min-h-14 min-w-11 items-center text-lg transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 sm:text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20";

  return (
    <header className="border-b border-border pt-6 sm:pt-8">
      <div className="flex items-center justify-between gap-4 pb-5 sm:pb-6">
        <Link prefetch={false} href="/" className="flex min-h-11 items-center rounded-sm text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:text-3xl">
          Yoryon
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label="账户菜单">
                <UserRound className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[calc(100dvh-6rem)] min-w-44 overflow-y-auto [&_[role=menuitem]]:min-h-11">
              <DropdownMenuItem asChild><Link prefetch={false} href="/settings/profile">个人资料</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link prefetch={false} href="/login">登录</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link prefetch={false} href="/register">注册</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link prefetch={false} href="/redeem">兑换激活码</Link></DropdownMenuItem>
              <div className="my-1 border-t border-border" role="separator" />
              <p className="px-2 py-1.5 text-xs text-muted-foreground">外观</p>
              <ThemeMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav aria-label="主导航" className="flex items-center justify-between gap-4">
        <div className="flex gap-6 sm:gap-8">
          <Link prefetch={false} href="/" aria-current={pathname === "/" ? "page" : undefined} className={`${tabClass} ${pathname === "/" ? "font-semibold text-foreground after:bg-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            首页
          </Link>
          <Link prefetch={false} href="/subscription" aria-current={subscriptionActive ? pathname === "/subscription" ? "page" : "location" : undefined} className={`${tabClass} ${subscriptionActive ? "font-semibold text-foreground after:bg-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            订阅
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`min-h-11 gap-2 px-2 text-base sm:text-lg ${exploreActive ? "text-foreground" : "text-muted-foreground"}`}>
              探索 <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40 [&_[role=menuitem]]:min-h-11">
            <DropdownMenuItem asChild><Link prefetch={false} href="/explore">全部探索</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link prefetch={false} href="/c">合集</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link prefetch={false} href="/explore#tags">标签</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link prefetch={false} href="/about">关于我</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
