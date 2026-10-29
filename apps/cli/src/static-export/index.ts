import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import {
  filterStoredMediaRefs,
  parseMarkdown,
  stringifyMarkdown,
  searchProjection,
} from "@yoryon/core";
import {
  staticSiteSchema,
  publicCollections,
  type StaticContent,
  type StaticCollection,
} from "@yoryon/config/static-site";
import { readSource } from "./source";
import { exportAssets } from "./media";
import { publishSnapshot } from "./publish";

const root = resolve(import.meta.dirname, "../../../..");
const config =
  process.env.YORYON_STATIC_CONFIG_DIR ?? resolve(homedir(), ".config/yoryon-production");
const iso = (date: Date | null) => date?.toISOString() ?? null;

async function exportSite(stage: string) {
  const source = await readSource(resolve(config, "secrets.json"));
  const contents: StaticContent[] = source.contents.map((c) => {
    const allowed = source.media.filter((m) => m.content_id === c.id);
    const body =
      c.visibility === "public"
        ? c.body
        : stringifyMarkdown(
            filterStoredMediaRefs(parseMarkdown(c.body), new Set(allowed.map((m) => m.media_id)))
          );
    return {
      id: c.id,
      revision: c.revision,
      type: c.type,
      slug: c.slug,
      title: c.title,
      description: c.description,
      bodyMarkdown: body,
      visibility: c.visibility,
      access: c.visibility === "public" ? "full" : "preview",
      hasPaidContent: c.visibility === "paid",
      updatedAt: iso(c.updated_at)!,
      publishedAt: iso(c.published_at),
      isPinned: c.is_pinned,
      showInHome: c.show_in_home,
      coverMediaId: c.cover_media_id,
      tags: source.tags
        .filter((t) => t.content_id === c.id)
        .map((t) => ({ slug: t.slug, name: t.name })),
      media: allowed.map((m) => ({
        mediaId: m.media_id,
        position: m.position,
        exposure: m.exposure,
        mimeType: m.mime_type,
        width: m.width,
        height: m.height,
        durationSec: m.duration_sec,
      })),
      collections: [],
      searchText: searchProjection(body).text,
    };
  });
  const byId = new Map(contents.map((c) => [c.id, c]));
  const collections: StaticCollection[] = publicCollections(
    source.collections.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      visibility: c.visibility,
      coverMediaId: c.cover_media_id,
      updatedAt: iso(c.updated_at)!,
      isPinned: c.is_pinned,
      items: source.items
        .filter((i) => i.collection_id === c.id)
        .map((i) => {
          const item = byId.get(i.content_id)!;
          return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            description: item.description,
            type: item.type,
            visibility: item.visibility,
            publishedAt: item.publishedAt,
            coverMediaId: item.coverMediaId,
            access: item.access,
            sortOrder: i.sort_order,
          };
        }),
    })),
    contents
  );
  for (const collection of collections)
    for (const [index, item] of collection.items.entries()) {
      const neighbour = (offset: number) => {
        const row = collection.items[index + offset];
        return row ? { slug: row.slug, title: row.title } : null;
      };
      byId.get(item.id)!.collections.push({
        id: collection.id,
        slug: collection.slug,
        title: collection.title,
        previous: neighbour(-1),
        next: neighbour(1),
      });
    }
  const candidates = new Map([
    ...source.media.map(
      (m) =>
        [
          m.media_id,
          { id: m.media_id, key: m.oss_key, mimeType: m.mime_type, bytes: Number(m.size_bytes) },
        ] as const
    ),
    ...source.covers.map(
      (m) =>
        [
          m.id,
          { id: m.id, key: m.oss_key, mimeType: m.mime_type, bytes: Number(m.size_bytes) },
        ] as const
    ),
  ]);
  const used = new Set<string>();
  for (const c of contents) {
    for (const match of c.bodyMarkdown.matchAll(/\/api\/media\/([a-f0-9-]{36})/gi))
      used.add(match[1]!);
    if (c.coverMediaId) used.add(c.coverMediaId);
  }
  for (const c of collections) if (c.coverMediaId) used.add(c.coverMediaId);
  const assets = await exportAssets(
    [...used].map((id) => {
      const item = candidates.get(id);
      if (!item) throw new Error("正文含未获准导出的媒体引用");
      return item;
    }),
    config,
    resolve(stage, "media"),
    resolve(root, "apps/web/public/media")
  );
  const site = staticSiteSchema.parse({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    contents,
    collections,
    assets,
  });
  await publishSnapshot(site, stage, root);
  console.log(
    JSON.stringify({
      contents: contents.length,
      collections: collections.length,
      media: assets.length,
      bytes: assets.reduce((n, a) => n + a.bytes, 0),
      paidBodies: "existing public previews only",
      largeFiles: assets
        .filter((a) => a.bytes > 25 * 1024 * 1024)
        .map((a) => ({ path: a.path, bytes: a.bytes })),
    })
  );
}
async function run() {
  await mkdir(resolve(root, ".local"), { recursive: true });
  const lockPath = resolve(root, ".local/static-export.lock");
  const lock = await open(lockPath, "wx").catch(() => {
    throw new Error("已有导出正在运行；请等待完成");
  });
  const stage = await mkdtemp(resolve(root, ".local/static-export-"));
  try {
    await exportSite(stage);
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
    await rm(stage, { recursive: true, force: true });
  }
}
run().catch((error) => {
  console.error(
    "静态导出失败；未输出凭据或底层查询参数。",
    error?.name === "ZodError"
      ? error.issues.map((issue: { path: unknown[] }) => issue.path.join(".")).join(",")
      : /^(已有导出|只读内容|付费预览|正文含|媒体|静态快照|凭据文件|缺少只读)/.test(
            error?.message ?? ""
          )
        ? error.message
        : "请核对配置和媒体读取权限。"
  );
  process.exitCode = 1;
});
