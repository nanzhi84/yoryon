/**
 * 有上限的流式请求体读取：Content-Length 预检 + 逐 chunk 字节累计，超限立即中止并取消流。
 * 用于匿名 ingest 入口（analytics）的大载荷防线：
 * - Content-Length 缺失（chunked）也能在 EOF 前拒绝；
 * - 必须按字节累计——字符串 length 是 UTF-16 码元数，多字节字符会绕过长度判断。
 * 返回 null 表示超限（调用方应返回 413）。
 */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      exceeded = true;
      break;
    }
    chunks.push(value);
  }
  if (exceeded) {
    await reader.cancel().catch(() => {});
    return null;
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}
