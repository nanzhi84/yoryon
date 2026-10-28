import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BackButton } from "@/components/back-button";
import { getTags } from "@/lib/static-site";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/tags", "标签", "按标签浏览 Yoryon 的文章与帖子。");
export default function TagsPage() {
  const tags = getTags();
  return (
    <>
      <SiteHeader />
      <main className="py-5">
        <BackButton />
        <h1 className="text-2xl font-semibold">标签</h1>
        {tags.length ? (
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
            {tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/tags/${t.slug}`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"
                >
                  #{t.name}
                  <span className="text-muted-foreground">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">还没有标签。</p>
        )}
      </main>
    </>
  );
}
