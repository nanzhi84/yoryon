import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// 所有页面级返回入口沿用文章页的点击区域与间距；所在 main 统一使用 pt-5。
export const backControlClassName = "mb-2 inline-flex min-h-11 items-center gap-2 rounded-sm text-[13px] leading-5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link prefetch={false} href={href} className={backControlClassName}><ArrowLeft className="size-4" aria-hidden="true" />{children}</Link>;
}
