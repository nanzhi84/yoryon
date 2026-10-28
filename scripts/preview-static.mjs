import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pipeline } from "node:stream";

const directory = resolve(import.meta.dirname, "../apps/web/out");
const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex < 0 ? 3000 : process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("预览端口应为1024–65535");
await stat(resolve(directory, "index.html")).catch(() => {
  throw new Error("请先运行 pnpm build 生成静态网站");
});
const mime = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".xml": "application/xml; charset=utf-8",
};
createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  let file = resolve(directory, `.${pathname}`);
  if (!file.startsWith(directory + sep) && file !== directory) {
    response.writeHead(403);
    response.end();
    return;
  }
  let info;
  let status = 200;
  try {
    info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, "index.html");
      info = await stat(file);
    }
    if (!info.isFile()) throw new Error();
  } catch {
    file = resolve(directory, "404.html");
    info = await stat(file);
    status = 404;
  }
  const headers = {
    "Content-Type": mime[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  let start = 0,
    end = info.size - 1;
  const range = request.headers.range;
  if (status === 200 && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { "Content-Range": `bytes */${info.size}` });
      response.end();
      return;
    }
    if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= info.size
    ) {
      response.writeHead(416, { "Content-Range": `bytes */${info.size}` });
      response.end();
      return;
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
  }
  response.writeHead(status, { ...headers, "Content-Length": Math.max(0, end - start + 1) });
  if (request.method === "HEAD" || !info.size) {
    response.end();
    return;
  }
  const stream = createReadStream(file, { start, end });
  response.on("close", () => stream.destroy());
  pipeline(stream, response, () => {});
}).listen(port, "127.0.0.1", () =>
  console.log(`静态预览：http://127.0.0.1:${port}（仅本机访问，无API进程）`)
);
