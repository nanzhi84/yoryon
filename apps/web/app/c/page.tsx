import type { Metadata } from "next";
import { publicFetch } from "@/lib/api";
import type { CollectionListItem } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { CollectionEntry } from "@/components/feed-timeline";

export const metadata: Metadata = { title: "合集" };

/**
 * 公开线：合集列表对所有人一致（ADR-0003）。
 * 单层缓存设计（同 sitemap）：路由层不缓存——避免构建期 API 不可达时预渲染出空壳页，
 * 在 revalidate 窗口内持续返回陈旧空态；新鲜度由内部 fetch 的 Data Cache 承担。
 */
export const dynamic = "force-dynamic";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);

export default async function CollectionsPage() {
  let items: CollectionListItem[] = [];
  try {
    const res = await publicFetch("/api/collections", { revalidate: revalidateSec });
    if (res.ok) items = ((await res.json()) as { items: CollectionListItem[] }).items;
  } catch {
    // API 暂不可达：展示空态，运行时请求会重试
  }

  return (
    <>
      <SiteHeader />
      <main>
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">还没有合集。</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((c) => (
              <CollectionEntry key={c.slug} item={c} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
