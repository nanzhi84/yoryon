"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { HeaderMenu } from "./header-menu";
import { ThemeToggle } from "./theme-toggle";
import { FollowMenu } from "./follow-menu";

const avatar = new URL("./header-avatar.png", import.meta.url).href;

export function SiteHeader() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const collectionActive = pathname === "/c" || pathname.startsWith("/c/");
  const exploreActive =
    pathname === "/explore" || pathname === "/tags" || pathname.startsWith("/tags/");
  const tabClass =
    "relative flex min-h-11 min-w-11 items-center text-base transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <header className="border-b border-border pt-5">
      <div className="flex items-center justify-between gap-2 pb-4 max-[360px]:gap-1.5">
        <div className="flex min-w-0 items-center gap-2 max-[360px]:gap-1.5 sm:gap-3">
          <Link
            prefetch={false}
            href="/"
            className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-sm text-[22px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-[360px]:gap-1.5 max-[360px]:text-lg"
          >
            <Image
              src={avatar}
              alt=""
              width={32}
              height={32}
              loading="eager"
              fetchPriority="low"
              className="size-8 rounded-full border border-surface-border object-cover object-[50%_30%] max-[360px]:size-6"
            />
            <span>Yoryon</span>
          </Link>
          <FollowMenu />
        </div>
        <div className="flex shrink-0 items-center gap-1 max-[360px]:gap-0">
          <Link
            href="/search"
            prefetch={false}
            aria-label="全站搜索"
            className="flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="主导航" className="flex items-center justify-between gap-1 sm:gap-4">
        <div className="flex gap-1.5 sm:gap-6">
          <Link
            prefetch={false}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`${tabClass} ${pathname === "/" ? "font-semibold text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            首页
          </Link>
          <Link
            prefetch={false}
            href="/posts"
            aria-current={pathname === "/posts" ? "page" : undefined}
            className={`${tabClass} ${pathname === "/posts" ? "font-semibold text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            帖子
          </Link>
          <Link
            prefetch={false}
            href="/c"
            aria-current={collectionActive ? (pathname === "/c" ? "page" : "location") : undefined}
            className={`${tabClass} ${collectionActive ? "font-semibold text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            合集
          </Link>
        </div>
        <HeaderMenu
          label="探索"
          trigger={<>探索 <ChevronDown className="size-4" aria-hidden="true" /></>}
          triggerClassName={`min-h-11 gap-1 px-1 text-base sm:gap-2 sm:px-2 ${exploreActive ? "text-foreground" : "text-muted-foreground"}`}
          panelClassName="w-40 p-1"
          align="end"
        >
          <Link prefetch={false} href="/tags" role="menuitem" tabIndex={-1}
            className="flex min-h-11 items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted focus:bg-muted">
            标签
          </Link>
        </HeaderMenu>
      </nav>
    </header>
  );
}
