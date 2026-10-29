import { readFile, stat } from "node:fs/promises";
import pg from "pg";

export async function protectedJson(path: string) {
  const info = await stat(path);
  if ((info.mode & 0o077) !== 0 || info.size > 65536)
    throw new Error("凭据文件必须为0600且不超过64KiB");
  return JSON.parse(await readFile(path, "utf8"));
}

/** Projection excludes credentials, account identifiers, hidden bodies and private discussions. */
export async function readSource(path: string) {
  const secrets = await protectedJson(path);
  const connectionString = process.env.DATABASE_URL ?? secrets.database_api_url;
  if (typeof connectionString !== "string") throw new Error("缺少只读内容数据库连接配置");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='30s'");
    const contents = (
      await client.query(`SELECT id, revision, type, slug, title, description,
      CASE WHEN visibility='public' THEN body_markdown ELSE public_preview_markdown END AS body,
      visibility, preview_revision, published_at, updated_at, is_pinned, show_in_home, cover_media_id
      FROM contents WHERE status='published' ORDER BY published_at DESC NULLS LAST,id`)
    ).rows;
    if (
      contents.some(
        (c) => c.visibility === "paid" && (c.body === null || c.preview_revision !== c.revision)
      )
    ) {
      throw new Error("付费预览版本不完整；停止导出，避免公开错误内容");
    }
    const tags = (
      await client.query(`SELECT ct.content_id,t.slug,t.name FROM content_tags ct
      JOIN tags t ON t.id=ct.tag_id JOIN contents c ON c.id=ct.content_id WHERE c.status='published' ORDER BY t.name,t.slug`)
    ).rows;
    const media = (
      await client.query(`SELECT cm.content_id,cm.media_id,cm.position,cm.exposure,
      m.mime_type,m.width,m.height,m.duration_sec,m.oss_key,m.size_bytes
      FROM content_media cm JOIN media_assets m ON m.id=cm.media_id JOIN contents c ON c.id=cm.content_id
      WHERE c.status='published' AND (c.visibility='public' OR cm.exposure='free') ORDER BY cm.position`)
    ).rows;
    const collections = (
      await client.query(
        "SELECT id,slug,title,description,visibility,cover_media_id,updated_at,is_pinned FROM collections ORDER BY is_pinned DESC,updated_at DESC,id"
      )
    ).rows;
    const items = (
      await client.query(`SELECT ci.collection_id,ci.content_id,ci.sort_order FROM collection_items ci
      JOIN contents c ON c.id=ci.content_id WHERE c.status='published' ORDER BY ci.sort_order,c.published_at,c.id`)
    ).rows;
    const covers = (
      await client.query(`SELECT id,oss_key,mime_type,size_bytes FROM media_assets m WHERE
      EXISTS(SELECT 1 FROM contents c WHERE c.status='published' AND c.cover_media_id=m.id)
      OR EXISTS(SELECT 1 FROM collections c WHERE c.cover_media_id=m.id)`)
    ).rows;
    await client.query("ROLLBACK");
    return { contents, tags, media, collections, items, covers };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("付费预览")) throw error;
    throw new Error("只读内容导出失败；连接与查询参数已隐藏");
  } finally {
    await client.end();
  }
}
