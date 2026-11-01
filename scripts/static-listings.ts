import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { readStaticCatalog } from "../packages/config/src/static-catalog";
import { feedListing, collectionListing, chapterListing, tagListing } from "../apps/web/lib/listing-build";
import { pageCount } from "../apps/web/lib/pagination";
import type { Listing } from "../apps/web/lib/listing";
export async function writeListings(directory: string, catalog: ReturnType<typeof readStaticCatalog>) {
  async function write(base: string, total: number, build: (page: number) => Listing) {
    const path = join(directory, "lists", base || "home");
    await mkdir(path, { recursive: true });
    for (let page = 1; page <= pageCount(total); page++)
      await writeFile(join(path, `${page}.json`), JSON.stringify(build(page)));
  }
  await write("", catalog.articles.length, p => feedListing(catalog, catalog.articles, p, true));
  await write("posts", catalog.posts.length, p => feedListing(catalog, catalog.posts, p, true));
  await write("c", catalog.site.collections.length, p => collectionListing(catalog, p));
  await write("tags", catalog.tags.length, p => tagListing(catalog, p));
  for (const [slug, contents] of catalog.tagged)
    await write(`tags/${slug}`, contents.length, p => feedListing(catalog, contents, p, false));
  for (const collection of catalog.site.collections) {
    await write(`c/${collection.slug}`, collection.items.length, p => chapterListing(collection, p, false));
    await write(`c/${collection.slug}/reverse`, collection.items.length, p => chapterListing(collection, p, true));
  }
}
