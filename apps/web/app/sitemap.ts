import type { MetadataRoute } from "next";
import { publicFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);
/**
 * 单层缓存设计：路由层不缓存（避免 ISR stale-while-revalidate 在过期边界返回构建期空壳），
 * 新鲜度由内部 feed fetch 的 Data Cache（revalidateSec）承担。
 */
export const dynamic = "force-dynamic";

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
    let page = 0;
    for (; page < MAX_PAGES; page++) {
      const res = await publicFetch(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { revalidate: revalidateSec });
      if (!res.ok) {
        // 遍历中途失败会产出不完整的 sitemap，必须留下可观测日志
        console.warn(JSON.stringify({ level: "warn", msg: "sitemap feed fetch failed, emitting partial sitemap", status: res.status, page, entries: entries.length }));
        break;
      }
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
      const next = data.nextCursor;
      if (!next) break;
      if (next === cursor) {
        console.warn(JSON.stringify({ level: "warn", msg: "sitemap traversal stopped: cursor not advancing", page, entries: entries.length }));
        break;
      }
      cursor = next;
    }
    if (page === MAX_PAGES) {
      console.warn(JSON.stringify({ level: "warn", msg: "sitemap traversal hit MAX_PAGES, emitting partial sitemap", maxPages: MAX_PAGES, entries: entries.length }));
    }
  } catch (err) {
    // sitemap 生成失败不阻塞部署，但保留诊断上下文
    console.warn(JSON.stringify({ level: "warn", msg: "sitemap generation failed", error: String(err) }));
  }
  return entries;
}
