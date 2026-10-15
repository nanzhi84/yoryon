import type { MetadataRoute } from "next";
import { publicFetch } from "@/lib/api";
import { siteUrl } from "@/lib/seo";

export const revalidate = 86400;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const res = await publicFetch("/api/sitemap", { revalidate: 86400, tags: ["sitemap"] });
  if (!res.ok) throw new Error(`sitemap snapshot API ${res.status}`);
  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray(data.entries)) {
    throw new Error("Invalid sitemap snapshot");
  }
  const paths = new Set(["/", "/posts", "/c", "/tags"]);
  for (const entry of data.entries) {
    // Only published reader/directory URLs belong here, never account/search/internal routes.
    if (!entry || typeof entry.path !== "string" || !/^\/(?:p|c)\/[a-z0-9][a-z0-9-]*$/.test(entry.path)) continue;
    paths.add(entry.path);
  }
  // updatedAt also changes on cache repair; omit optional lastmod until a content-only
  // modification time exists. Build time and generic row updates are not substitutes.
  return [...paths].map(path => ({ url: siteUrl(path) }));
}
