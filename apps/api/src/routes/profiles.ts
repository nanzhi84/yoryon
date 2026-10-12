/** 自助资料：展示名与账号标识分离，头像只接收图片字节，不接收外部 URL/任意资产引用。 */
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import sharp from "sharp";
import { mediaAssets, users } from "@yoryon/db";
import { PUBLISH_GC_LOCK_NAME } from "@yoryon/config";
import { toAuthorDto, validDisplayName } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { requireAuth, type AppVariables } from "../middleware/auth";
import { errorResponse } from "../errors";
import { checkRate } from "./auth";
import { uuidRe } from "./questions";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const types: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" };
export function profileRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  app.get("/users/:id/profile", async c => {
    if (!uuidRe.test(c.req.param("id"))) return errorResponse(c, 404, "not_found", "用户不存在");
    const rows = await deps.db.select({ username: users.username, displayName: users.displayName, avatarMediaId: users.avatarMediaId })
      .from(users).where(eq(users.id, c.req.param("id"))).limit(1);
    if (!rows[0]) return errorResponse(c, 404, "not_found", "用户不存在");
    return c.json({ profile: toAuthorDto(rows[0]) });
  });
  app.get("/me/profile", c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    return c.json({ profile: toAuthorDto(auth.user) });
  });
  app.patch("/me/profile", async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const body = await c.req.json().catch(() => null) as { displayName?: unknown } | null;
    if (!body || Object.keys(body).some(k => k !== "displayName") || (body.displayName !== null && !validDisplayName(body.displayName)))
      return errorResponse(c, 400, "invalid_profile", "展示名需为 1-40 字，不含控制字符或尖括号");
    const rows = await deps.db.update(users).set({ displayName: body.displayName === null ? null : (body.displayName as string).trim(), updatedAt: new Date() })
      .where(eq(users.id, auth.user.id)).returning();
    return c.json({ profile: toAuthorDto(rows[0]!) });
  });
  app.post("/me/avatar", async (c, next) => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [{ key: `avatar:${auth.user.id}`, limit: 5, windowMs: 60_000 }]);
    if (limited) return limited;
    await next();
  }, bodyLimit({ maxSize: AVATAR_MAX_BYTES, onError: c => errorResponse(c, 413, "payload_too_large", "头像最大为 2MB") }), async c => {
    const auth = c.get("auth")!;
    const mime = c.req.header("content-type")?.split(";")[0]!;
    if (!types[mime]) return errorResponse(c, 400, "invalid_image", "头像仅支持 PNG、JPEG、WebP");
    let output: Buffer;
    try {
      const input = Buffer.from(await c.req.arrayBuffer());
      const image = sharp(input, { limitInputPixels: 16_000_000, animated: false, failOn: "error" });
      const metadata = await image.metadata();
      if (metadata.format !== types[mime] || (metadata.pages ?? 1) > 1) return errorResponse(c, 400, "invalid_image", "图片格式不匹配或包含动画");
      // 解码后重编码，去除 SVG/脚本、EXIF 和其他元数据；限制像素防止解压资源耗尽。
      output = await image.rotate().resize(320, 320, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
    } catch { return errorResponse(c, 400, "invalid_image", "图片无法解码或尺寸过大"); }
    const key = `avatars/${createHash("sha256").update(output).digest("hex")}.webp`;
    const profile = await deps.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${PUBLISH_GC_LOCK_NAME}, 0))`);
      await deps.storage.put(key, output, { contentType: "image/webp" });
      await tx.select({ id: users.id }).from(users).where(eq(users.id, auth.user.id)).for("update");
      const inserted = await tx.insert(mediaAssets).values({ ossKey: key, mimeType: "image/webp", sizeBytes: output.length, width: 320, height: 320 })
        .onConflictDoNothing({ target: mediaAssets.ossKey }).returning({ id: mediaAssets.id });
      const asset = inserted[0] ?? (await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.ossKey, key)).limit(1))[0]!;
      const rows = await tx.update(users).set({ avatarMediaId: asset.id, updatedAt: new Date() }).where(eq(users.id, auth.user.id)).returning();
      return toAuthorDto(rows[0]!);
    });
    return c.json({ profile });
  });
  app.delete("/me/avatar", async c => {
    const auth = requireAuth(c); if (auth instanceof Response) return auth;
    const rows = await deps.db.update(users).set({ avatarMediaId: null, updatedAt: new Date() }).where(eq(users.id, auth.user.id)).returning();
    return c.json({ profile: toAuthorDto(rows[0]!) });
  });
  app.get("/avatars/:id", async c => {
    const id = c.req.param("id");
    if (!uuidRe.test(id)) return errorResponse(c, 404, "not_found", "头像不存在");
    const rows = await deps.db.select({ key: mediaAssets.ossKey }).from(mediaAssets).innerJoin(users, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(mediaAssets.id, id)).limit(1);
    if (!rows[0] || !/^avatars\/[a-f0-9]{64}\.webp$/.test(rows[0].key)) return errorResponse(c, 404, "not_found", "头像不存在");
    const bytes = await deps.storage.get(rows[0].key);
    if (!bytes) return errorResponse(c, 404, "not_found", "头像不存在");
    c.header("Content-Type", "image/webp"); c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", "default-src 'none'; sandbox");
    return c.body(new Uint8Array(bytes));
  });
  return app;
}
