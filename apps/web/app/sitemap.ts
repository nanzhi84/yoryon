import type { MetadataRoute } from "next";
import { publicFetch } from "@/lib/api";

export const revalidate = 86400;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const res = await publicFetch("/api/sitemap", { revalidate: 86400, tags: ["sitemap"] });
  if (!res.ok) throw new Error(`sitemap snapshot API ${res.status}`);
  const data = await res.json() as { entries: { path: string; updatedAt: string }[] };
  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/c`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/tags`, changeFrequency: "weekly", priority: 0.5 },
    ...data.entries.map(e => ({ url: `${site}${e.path}`, lastModified: e.updatedAt })),
  ];
}
