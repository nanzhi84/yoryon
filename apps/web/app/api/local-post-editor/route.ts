import { EditorError, editorDirectory, readFormatPosts, saveFormatPost } from "@/lib/local-post-editor";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
function guard(request: Request, write = false) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? "";
  if (!editorDirectory() || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw new EditorError("未启用本地编辑器", 404);
  if (write && request.headers.get("origin") !== `${url.protocol}//${host}`) throw new EditorError("仅允许本地编辑页面保存", 403);
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof EditorError ? error.message : "本地文件读取或保存失败，请保留文本后重试。" },
    { status: error instanceof EditorError ? error.status : 500, headers });
}
export async function GET(request: Request) {
  try { guard(request); return Response.json(await readFormatPosts(), { headers }); } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    guard(request, true);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 100_000) throw new EditorError("短帖内容过长", 413);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new EditorError("保存内容无效", 400); }
    if (!data || typeof data !== "object" || !("slug" in data) || typeof data.slug !== "string" || !("markdown" in data)
      || typeof data.markdown !== "string" || !("revision" in data) || typeof data.revision !== "string"
      || !/^[a-f0-9]{64}$/.test(data.revision)) throw new EditorError("保存内容无效", 400);
    return Response.json(await saveFormatPost(data.slug, data.markdown, data.revision), { headers });
  } catch (error) { return failure(error); }
}
