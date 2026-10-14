"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Search, Star, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ThemeMenuItems } from "./theme-menu-items";
import { AccountMenuItems } from "./account-menu-items";
import { NotificationBell } from "./notification-bell";

export function SiteHeader() {
  const pathname = usePathname();
  const subscriptionActive = pathname === "/subscription" || pathname.startsWith("/questions/");
  const exploreActive = pathname === "/explore" || pathname === "/c" || pathname.startsWith("/c/") || pathname === "/tags" || pathname.startsWith("/tags/");
  const tabClass = "relative flex min-h-11 min-w-11 items-center text-base transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <header className="border-b border-border pt-5">
      <div className="flex items-center justify-between gap-3 pb-4">
        <Link prefetch={false} href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-sm text-[22px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Image src="/images/author-avatar.jpg" alt="" width={32} height={32} priority className="size-8 rounded-full border border-surface-border object-cover object-[50%_30%]" />
          <span>Yoryon</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/search" prefetch={false} aria-label="全站搜索" className="flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Search className="size-[18px]" aria-hidden="true" /></Link>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label="账户菜单">
                <UserRound className="size-[18px]" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[calc(100dvh-6rem)] min-w-44 overflow-y-auto [&_[role=menuitem]]:min-h-11">
              <AccountMenuItems />
              <div className="my-1 border-t border-border" role="separator" />
              <p className="px-2 py-1.5 text-xs text-muted-foreground">外观</p>
              <ThemeMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav aria-label="主导航" className="flex items-center justify-between gap-4">
        <div className="flex gap-6">
          <Link prefetch={false} href="/" aria-current={pathname === "/" ? "page" : undefined} className={`${tabClass} ${pathname === "/" ? "font-semibold text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
            首页
          </Link>
          <Link prefetch={false} href="/subscription" aria-current={subscriptionActive ? pathname === "/subscription" ? "page" : "location" : undefined} className={`${tabClass} gap-2 ${subscriptionActive ? "font-semibold text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
            订阅 <Star className="size-3 text-primary" aria-hidden="true" />
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`min-h-11 gap-2 px-2 text-base ${exploreActive ? "text-foreground" : "text-muted-foreground"}`}>
              探索 <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40 [&_[role=menuitem]]:min-h-11">
            <DropdownMenuItem asChild><Link prefetch={false} href="/c">合集</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link prefetch={false} href="/tags">标签</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
