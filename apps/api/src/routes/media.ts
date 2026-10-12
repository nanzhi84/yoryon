/**
 * 媒体分发与（fs 后端的）字节回源。
 * GET /api/media/:id —— 验权 → 302 签名 URL；缓存双线（ADR-0003 修订）。
 * GET /api/storage-object/* —— fs 存储的签名 URL 字节服务（HMAC 验签 + Range/206），模拟 OSS 行为。
 */
import { Hono } from "hono";
import { MEDIA_FREE_CACHE_MAX_AGE_SEC } from "@yoryon/config";
import { IMAGE_WIDTHS, IMAGE_WEBP_QUALITY } from "@yoryon/config/image-variants";
import { findMediaById, FsStorage, isValidMediaKey, mimeForFile, resolveMediaAccess } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import type { AppVariables } from "../middleware/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mediaRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/media/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return errorResponse(c, 404, "not_found", "媒体不存在");
    const media = await findMediaById(deps.db, id.toLowerCase());
    if (!media) return errorResponse(c, 404, "not_found", "媒体不存在");
    const rawWidth = c.req.query("width");
    const width = rawWidth === undefined ? undefined : Number(rawWidth);
    if (width !== undefined && (!IMAGE_WIDTHS.includes(width as typeof IMAGE_WIDTHS[number]) || String(width) !== rawWidth)) return errorResponse(c, 400, "invalid_width", "图片宽度不在允许档位");

    const auth = c.get("auth");
    const access = await resolveMediaAccess(deps.db, media.id, auth?.user ?? null, new Date());
    if (!access.allow) {
      c.header("Cache-Control", "private, no-store");
      return errorResponse(c, 403, "forbidden", "无权访问该媒体");
    }

    const resize = width && /^(image\/jpeg|image\/png|image\/webp)$/.test(media.mimeType) && (media.width ?? 0) > width ? width : undefined;
    const url = await deps.storage.signGetUrl(media.ossKey, deps.env.MEDIA_SIGN_TTL, resize);
    if (access.via === "entitlement") {
      // 权益命中：缓存付费 302 = 签名 URL 泄露（ADR-0003）
      c.header("Cache-Control", "private, no-store");
    } else {
      // 免费规则命中（身份无关）：共享缓存，max-age 必须小于签名 TTL
      c.header("Cache-Control", `public, max-age=${MEDIA_FREE_CACHE_MAX_AGE_SEC}`);
    }
    return c.redirect(url, 302);
  });

  // fs 存储后端的字节回源（本地开发 / E2E）。生产 OSS 由对象存储直接服务，不经过此路由。
  if (deps.storage.kind === "fs") {
    const fsStorage = deps.storage as FsStorage;
    app.get("/storage-object/*", async (c) => {
      const key = decodeURIComponent(c.req.path.slice("/api/storage-object/".length));
      if (!isValidMediaKey(key)) return errorResponse(c, 404, "not_found", "对象不存在");
      const expires = Number(c.req.query("expires"));
      const sig = c.req.query("sig") ?? "";
      const width = c.req.query("width") === undefined ? undefined : Number(c.req.query("width"));
      const rawFormat = c.req.query("format");
      if (rawFormat !== undefined && rawFormat !== "webp") return errorResponse(c, 403, "invalid_signature", "派生格式无效");
      const format = rawFormat as "webp" | undefined;
      if (width !== undefined && !IMAGE_WIDTHS.includes(width as typeof IMAGE_WIDTHS[number])) return errorResponse(c, 403, "invalid_signature", "派生宽度无效");
      if (!Number.isFinite(expires) || !fsStorage.verifyGetSignature(key, expires, sig, width, format)) {
        return errorResponse(c, 403, "invalid_signature", "签名无效或已过期");
      }
      let data = await fsStorage.read(key);
      if (data === null) return errorResponse(c, 404, "not_found", "对象不存在");
      if (width || format) {
        const { default: sharp } = await import("sharp");
        let image = sharp(data, { limitInputPixels: 40_000_000 }).rotate();
        if (width) image = image.resize({ width, withoutEnlargement: true });
        if (format) image = image.webp({ quality: IMAGE_WEBP_QUALITY, effort: 6 });
        data = await image.toBuffer();
      }

      const contentType = format ? "image/webp" : mimeForFile(key);
      const range = c.req.header("range");
      c.header("Accept-Ranges", "bytes");
      c.header("Cache-Control", "private, max-age=604800");
      c.header("Content-Type", contentType);
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (m) {
          let start = m[1] ? parseInt(m[1], 10) : 0;
          let end = m[2] ? parseInt(m[2], 10) : data.length - 1;
          if (m[1] === "" && m[2]) {
            // suffix range: bytes=-500
            start = Math.max(0, data.length - parseInt(m[2], 10));
            end = data.length - 1;
          }
          if (start >= data.length || start > end) {
            c.header("Content-Range", `bytes */${data.length}`);
            return c.body(null, 416);
          }
          end = Math.min(end, data.length - 1);
          const slice = data.subarray(start, end + 1);
          c.header("Content-Range", `bytes ${start}-${end}/${data.length}`);
          c.header("Content-Length", String(slice.length));
          return c.body(new Uint8Array(slice), 206);
        }
      }
      c.header("Content-Length", String(data.length));
      return c.body(new Uint8Array(data), 200);
    });
  }

  return app;
}
