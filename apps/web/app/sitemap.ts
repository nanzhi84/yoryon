import type { MetadataRoute } from "next";
import { publicFetchNoStore } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";

/**
 * 单层缓存设计：路由层不缓存（避免 ISR stale-while-revalidate 在过期边界返回构建期空壳）。
 * 内部 fetch 也全部 no-store——Data Cache 过期后是 stale-while-revalidate，会返回滞后一个
 * 缓存窗口的旧分页（首页 URL 被高频访问必然命中），sitemap 必须反映当前库状态，
 * 且自身低频、每页 URL 不同，缓存本无收益。
 */
export const dynamic = "force-dynamic";

/** 翻页上限：防止游标异常导致死循环；每页 FEED_PAGE_SIZE=20，1000 页覆盖 2 万条。 */
const MAX_PAGES = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/c`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];
  try {
    // 合集为顶层结构，不经 feed 曝光；sitemap 从合集列表端点单独收录。
    const colRes = await publicFetchNoStore("/api/collections");
    if (colRes.ok) {
      const data = (await colRes.json()) as { items: { slug: string; updatedAt: string }[] };
      for (const c of data.items) {
        entries.push({ url: `${siteUrl}/c/${c.slug}`, lastModified: c.updatedAt });
      }
    }
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", msg: "sitemap collections fetch failed, emitting partial sitemap", error: String(err) }));
  }
  try {
    // 全量翻页收录历史内容（feed 游标翻页直到 nextCursor 为空）
    let cursor: string | null = null;
    let page = 0;
    for (; page < MAX_PAGES; page++) {
      const res = await publicFetchNoStore(`/api/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!res.ok) {
        // 遍历中途失败会产出不完整的 sitemap，必须留下可观测日志
        console.warn(JSON.stringify({ level: "warn", msg: "sitemap feed fetch failed, emitting partial sitemap", status: res.status, page, entries: entries.length }));
        break;
      }
      const data = (await res.json()) as FeedResponse;
      for (const item of data.items) {
        entries.push({
          url: `${siteUrl}/p/${item.slug}`,
          ...(item.publishedAt ? { lastModified: item.publishedAt } : {}),
        });
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
