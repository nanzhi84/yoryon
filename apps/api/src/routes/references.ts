import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { contents } from "@yoryon/db";
import { collectStoredMediaIds, parseMarkdown, workReferenceSummary } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { loadContentDetail } from "./content-detail";

export function referenceRoutes(deps: AppDeps) {
  const app = new Hono();
  app.get("/public/references/:id", async c => {
    c.header("Cache-Control", "no-store");
    const id = c.req.param("id");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ available: false }, 404);
    const [row] = await deps.db.select({ slug: contents.slug }).from(contents).where(and(eq(contents.id, id), eq(contents.status, "published"))).limit(1);
    if (!row) return c.json({ available: false }, 404);
    const data = await loadContentDetail(deps, row.slug, null);
    if (!data || data.id !== id.toLowerCase()) return c.json({ available: false }, 404);
    const allowedMedia = new Set(collectStoredMediaIds(parseMarkdown(data.bodyMarkdown)));
    const media = data.type === "post" ? data.media.find(m => allowedMedia.has(m.mediaId)) ?? null : null;
    return c.json({ available: true, id: data.id, slug: data.slug, type: data.type,
      title: data.title, description: data.description, summary: workReferenceSummary(data.bodyMarkdown),
      coverMediaId: data.coverMediaId, media, visibility: data.visibility, publishedAt: data.publishedAt });
  });
  return app;
}
