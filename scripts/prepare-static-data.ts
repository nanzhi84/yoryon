import { mkdir, mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { readStaticCatalog } from "../packages/config/src/static-catalog";
import { writeSearch } from "./static-search";
import { writeListings } from "./static-listings";

const root = resolve(import.meta.dirname, "..");
const local = resolve(root, ".local");
await mkdir(local, { recursive: true });
const lockPath = join(local, "static-data.lock");
const lock = await open(lockPath, "wx").catch((error: NodeJS.ErrnoException) => {
  if (error.code === "EEXIST") throw new Error("静态数据构建正在运行");
  throw error;
});
let stage: string | undefined;
try {
  stage = await mkdtemp(join(local, "static-data-"));
  const catalog = readStaticCatalog(resolve(root, "content/site.json"));
  const directory = join(stage, catalog.version);
  const refs = join(directory, "references");
  await mkdir(refs, { recursive: true });
  for (const content of catalog.site.contents) {
    const media = content.media[0];
    const src = media ? catalog.mediaById.get(media.mediaId)?.path : undefined;
    if (media && !src) throw new Error("公开引用缺少媒体文件映射");
    await writeFile(join(refs, `${content.id}.json`), JSON.stringify({
      available: true, slug: content.slug, type: content.type, title: content.title,
      summary: content.searchText.slice(0, 160), description: content.description,
      visibility: content.visibility, coverMediaId: content.coverMediaId,
      media: media ? { ...media, src } : null,
    }));
  }
  for (const collection of catalog.site.collections) {
    const chapters = join(directory, "collections", collection.id);
    await mkdir(chapters, { recursive: true });
    for (const [i, item] of collection.items.entries())
      await writeFile(join(chapters, `${item.id}.json`), JSON.stringify({
        id: item.id, slug: item.slug, title: item.title, publishedAt: item.publishedAt, position: i + 1,
      }));
  }
  const shards = await writeSearch(join(directory, "search"), catalog.site.contents.map(c => ({
    slug: c.slug, title: c.title, description: c.description, text: c.searchText,
    publishedAt: c.publishedAt, type: c.type,
  })));
  await writeListings(directory, catalog);
  const destination = resolve(root, "apps/web/public/data/static");
  await mkdir(resolve(destination, ".."), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await rename(stage, destination);
  console.log(JSON.stringify({ staticData: { version: catalog.version, contents: catalog.site.contents.length, shards } }));
} finally {
  if (stage) await rm(stage, { recursive: true, force: true });
  await lock.close();
  await rm(lockPath, { force: true });
}
