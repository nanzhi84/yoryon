import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { StaticSite } from "@yoryon/config/static-site";

/** Replace only export-owned paths; withdrawn public files must disappear on refresh. */
export async function publishSnapshot(site: StaticSite, stage: string, root: string) {
  const references = resolve(stage, "references");
  await mkdir(references, { recursive: true });
  for (const c of site.contents)
    await writeFile(
      resolve(references, `${c.id}.json`),
      JSON.stringify({
        available: true,
        slug: c.slug,
        type: c.type,
        title: c.title,
        summary: c.searchText.slice(0, 160),
        description: c.description,
        coverMediaId: c.coverMediaId,
        visibility: c.visibility,
        media: c.media[0] ?? null,
      })
    );
  await writeFile(resolve(stage, "site.json"), JSON.stringify(site, null, 2) + "\n");
  await writeFile(
    resolve(stage, "media.json"),
    JSON.stringify(Object.fromEntries(site.assets.map((a) => [a.id, a.path])), null, 2) + "\n"
  );
  const replacements = [
    ["media", "apps/web/public/media"],
    ["references", "apps/web/public/data/references"],
    ["media.json", "content/media.json"],
    ["site.json", "content/site.json"],
  ];
  const applied: { target: string; previous: string; existed: boolean; installed: boolean }[] = [];
  try {
    for (const [source, destination] of replacements) {
      const target = resolve(root, destination!);
      const previous = resolve(stage, `previous-${source}`);
      await mkdir(dirname(target), { recursive: true });
      const item = { target, previous, existed: false, installed: false };
      applied.push(item);
      try {
        await rename(target, previous);
        item.existed = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await rename(resolve(stage, source!), target);
      item.installed = true;
    }
  } catch {
    for (const item of applied.reverse()) {
      if (item.installed) await rm(item.target, { recursive: true, force: true });
      if (item.existed) await rename(item.previous, item.target);
    }
    throw new Error("静态快照提交失败，已恢复上一份完整产物");
  }
}
