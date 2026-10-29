import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const tag = z.object({ slug, name: z.string() });
const chapter = z.object({ slug, title: z.string() });
const media = z.object({
  mediaId: uuid,
  position: z.number().int().nonnegative(),
  exposure: z.enum(["free", "paid"]),
  mimeType: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationSec: z.number().nullable(),
});
export const staticContentSchema = z.object({
  id: uuid,
  revision: uuid,
  type: z.enum(["article", "post"]),
  slug,
  title: z.string(),
  description: z.string(),
  bodyMarkdown: z.string(),
  visibility: z.enum(["public", "paid"]),
  access: z.enum(["full", "preview"]),
  hasPaidContent: z.boolean(),
  updatedAt: timestamp,
  publishedAt: timestamp.nullable(),
  isPinned: z.boolean(),
  showInHome: z.boolean(),
  coverMediaId: uuid.nullable(),
  tags: z.array(tag),
  media: z.array(media),
  collections: z.array(
    z.object({
      id: uuid,
      slug,
      title: z.string(),
      previous: chapter.nullable(),
      next: chapter.nullable(),
    })
  ),
  searchText: z.string(),
});
export const staticCollectionSchema = z.object({
  id: uuid,
  slug,
  title: z.string(),
  description: z.string(),
  visibility: z.enum(["public", "paid"]),
  coverMediaId: uuid.nullable(),
  updatedAt: timestamp,
  isPinned: z.boolean(),
  items: z.array(
    z.object({
      id: uuid,
      slug,
      title: z.string(),
      description: z.string(),
      type: z.enum(["article", "post"]),
      visibility: z.enum(["public", "paid"]),
      publishedAt: timestamp.nullable(),
      coverMediaId: uuid.nullable(),
      access: z.enum(["full", "preview"]),
      sortOrder: z.number().int(),
    })
  ),
});
export const staticSiteSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: timestamp,
  contents: z.array(staticContentSchema),
  collections: z.array(staticCollectionSchema),
  assets: z.array(
    z.object({
      id: uuid,
      path: z.string().regex(/^\/media\/[a-f0-9-]{36}\.[a-z0-9]+$/),
      mimeType: z.string(),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
  ),
});
export type StaticContent = z.infer<typeof staticContentSchema>;
export type StaticCollection = z.infer<typeof staticCollectionSchema>;
export type StaticSite = z.infer<typeof staticSiteSchema>;

/** A directory is public only when every published chapter is fully public. */
export function publicCollections(
  collections: readonly StaticCollection[],
  contents: readonly StaticContent[]
) {
  const byId = new Map(contents.map((content) => [content.id, content]));
  return collections.filter(
    (collection) =>
      collection.visibility === "public" &&
      collection.items.every((item) => {
        const content = byId.get(item.id);
        return (
          item.visibility === "public" &&
          item.access === "full" &&
          content?.slug === item.slug &&
          content.visibility === "public" &&
          content.access === "full"
        );
      })
  );
}
