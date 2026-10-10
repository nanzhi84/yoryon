import type { MetadataRoute } from "next";
import { apiFetch } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";

const revalidateSec = Number(process.env.FEED_REVALIDATE_SEC ?? 60);
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
  ];
  try {
    const res = await apiFetch("/api/feed", { revalidate: revalidateSec });
    if (res.ok) {
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
    }
  } catch {
    // sitemap 生成失败不阻塞部署
  }
  return entries;
}
