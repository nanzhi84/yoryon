import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { contents } from "@yoryon/db";
import { truncateForPreview, workReferenceSummary } from "@yoryon/core";
import type { AppDeps } from "../deps";

export function referenceRoutes(deps: AppDeps) {
  const app = new Hono();
  app.get("/public/references/:id", async c => {
    c.header("Cache-Control", "no-store");
    const id = c.req.param("id");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ available: false }, 404);
    const [row] = await deps.db.select().from(contents).where(and(eq(contents.id, id), eq(contents.status, "published"))).limit(1);
    if (!row) return c.json({ available: false }, 404);
    const allowed = row.visibility === "public" ? row.bodyMarkdown
      : truncateForPreview(row.bodyMarkdown, row.previewMode, row.previewPercent, { mediaBlockWeight: deps.env.MEDIA_BLOCK_WEIGHT }).freeMarkdown;
    return c.json({ available: true, id: row.id, slug: row.slug, type: row.type,
      title: row.title, description: row.description, summary: workReferenceSummary(allowed),
      coverMediaId: row.coverMediaId, visibility: row.visibility, publishedAt: row.publishedAt?.toISOString() ?? null });
  });
  return app;
}
