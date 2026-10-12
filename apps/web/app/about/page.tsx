import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/site.config";

export const metadata: Metadata = { title: "关于" };

function Avatar({ className }: { className?: string }) {
  const cls = `shrink-0 overflow-hidden rounded-full bg-muted ${className ?? ""}`;
  if (site.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={site.avatar} alt={site.name} className={`${cls} object-cover`} />;
  }
  return (
    <div className={`${cls} flex items-center justify-center font-medium text-muted-foreground`} aria-hidden>
      {site.name.slice(0, 1)}
    </div>
  );
}

/** 关于页：头像 + 名字 + 简介（可多段）+ 社交账号罗列。资料配置见 site.config.ts。容器宽度由 layout 统一控制。 */
export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="pb-20">
      <div className="py-12">
        {/* 头像 + 名字 */}
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 text-3xl" />
          <h1 className="text-3xl font-semibold tracking-tight">{site.name}</h1>
        </div>

        {/* 简介 */}
        <div className="mt-8 max-w-prose space-y-4 leading-relaxed text-foreground/90">
          {site.bioLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {/* 社交账号 */}
        <div className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">找到我</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {site.links.map((l) => (
              <li key={l.label}>
                <Link prefetch={false}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </main>
    </>
  );
}
