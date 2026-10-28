import type { MetadataRoute } from "next";
import { getContents, getCollections, getTags } from "@/lib/static-site";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/posts",
    "/c",
    "/tags",
    ...getContents().map((c) => `/p/${c.slug}`),
    ...getCollections().map((c) => `/c/${c.slug}`),
    ...getTags().map((t) => `/tags/${t.slug}`),
  ].map((path) => ({ url: siteUrl(path) }));
}
