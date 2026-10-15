import { Hono } from "hono";
import { imageEtag, validImageVariant } from "@yoryon/config/image-variants";
import type { AppDeps } from "../deps";
import type { PublicPolicy } from "../public-policy";
import type { GifVariantReader } from "../gif-variant";

/** Anonymous byte source for the gated Vercel cache; never exposes a signed URL. */
export function publicImageRoutes(deps: AppDeps, policy: PublicPolicy, gifVariant: GifVariantReader) {
  const app = new Hono();
  for (const path of ["/public/image-policy/:id", "/public/images/:id/:variant"]) {
    app.use(path, async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  }
  app.get("/public/image-policy/:id", async c => {
    if (!/^[a-f0-9-]{36}$/.test(c.req.param("id"))) return c.json({ error: "not_found" }, 404);
    const image = await policy.image(c.req.param("id"));
    if (!image) return c.json({ error: "forbidden" }, 403);
    return c.json({ hash: image.ossKey.slice(6).split(".")[0], mimeType: image.mimeType });
  });
  app.get("/public/images/:id/:variant", async c => {
    const { id, variant } = c.req.param();
    if (!/^[a-f0-9-]{36}$/.test(id!)) return c.json({ error: "not_found" }, 404);
    if (!validImageVariant(variant!) || new URL(c.req.url).search) return c.json({ error: "invalid_variant" }, 400);
    const image = await policy.image(id!);
    if (!image) return c.json({ error: "forbidden" }, 403);
    const raster = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(image.mimeType);
    const width = raster && variant !== "original" ? Number(variant) : undefined;
    if (image.mimeType === "image/gif") {
      const data = await gifVariant(image.ossKey, width, c.req.raw.signal);
      c.header("Content-Type", "image/webp");
      c.header("ETag", imageEtag(image.ossKey.slice(6).split(".")[0]!, variant!));
      c.header("X-Content-Type-Options", "nosniff");
      return c.body(new Uint8Array(data));
    }
    const url = await deps.storage.signGetUrl(image.ossKey, deps.env.MEDIA_SIGN_TTL, width, raster ? "webp" : undefined);
    const source = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!source.ok || !source.body) return c.json({ error: "image_unavailable" }, 502);
    c.header("Content-Type", raster ? "image/webp" : image.mimeType);
    c.header("ETag", imageEtag(image.ossKey.slice(6).split(".")[0]!, variant!));
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return c.body(source.body);
  });
  return app;
}
