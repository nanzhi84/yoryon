import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { collections, contents } from "@yoryon/db";
import type { AppDeps } from "../deps";

export function sitemapRoutes(deps: AppDeps) {
  const app = new Hono();
  app.get("/sitemap", async c => {
    const [posts, series] = await Promise.all([
      deps.db.select({ slug: contents.slug, updatedAt: contents.updatedAt }).from(contents).where(eq(contents.status, "published")),
      deps.db.select({ slug: collections.slug, updatedAt: collections.updatedAt }).from(collections),
    ]);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    return c.json({ entries: [...posts.map(p => ({ path: `/p/${p.slug}`, updatedAt: p.updatedAt.toISOString() })), ...series.map(p => ({ path: `/c/${p.slug}`, updatedAt: p.updatedAt.toISOString() }))] });
  });
  return app;
}
