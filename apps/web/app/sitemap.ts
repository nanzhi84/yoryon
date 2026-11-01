import type { MetadataRoute } from "next";
import { getCatalog, getContents } from "@/lib/static-site";
import { collectionPaths } from "@/lib/collection-routes";
import { tagPaths } from "@/lib/tag-routes";
import { pageCount, pagePath } from "@/lib/pagination";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/posts", ...collectionPaths().filter(path => !path.includes("/reverse")), ...tagPaths(), ...getContents().map(c => `/p/${c.slug}`)];
  for (const [base, total] of [["", getCatalog().articles.length], ["/posts", getCatalog().posts.length]] as const)
    for (let page = 2; page <= pageCount(total); page++) paths.push(pagePath(base, page));
  return paths.map(path => ({ url: siteUrl(path) }));
}
