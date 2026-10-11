import type { MetadataRoute } from "next";
import { publicFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);
export const revalidate = 60;

/** 翻页上限：防止游标异常导致死循环；每页 FEED_PAGE_SIZE=20，1000 页覆盖 2 万条。 */
const MAX_PAGES = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
  ];
  try {
    // 全量翻页收录历史内容/合集（feed 为公开缓存线，游标翻页直到 nextCursor 为空）
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await publicFetch(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { revalidate: revalidateSec });
      if (!res.ok) break;
      const data = (await res.json()) as FeedResponse;
      for (const item of data.items) {
        if (item.kind === "content") {
          entries.push({
            url: `${siteUrl}/p/${item.slug}`,
            ...(item.publishedAt ? { lastModified: item.publishedAt } : {}),
          });
        } else {
          entries.push({ url: `${siteUrl}/c/${item.slug}` });
        }
      }
      cursor = data.nextCursor;
      if (!cursor) break;
    }
  } catch {
    // sitemap 生成失败不阻塞部署
  }
  return entries;
}
