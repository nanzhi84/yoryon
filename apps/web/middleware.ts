import { NextResponse, type NextRequest } from "next/server";
import { catalogScopeForSource } from "@yoryon/config/cache";
import { imageMiddleware } from "./lib/image-middleware";

/** Middleware 先于共享正文缓存；revision key 隔离生成竞态，失败关闭。
 * 门禁通过 API 读取数据库当前 revision；不读取正文，不依赖缓存事件投递成功。
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/images/")) return imageMiddleware(request);
  const match = /^\/render\/([a-f0-9-]{36})\/([a-z0-9][a-z0-9-]*)$/.exec(path);
  const privateHeaders = { "Cache-Control": "private, no-store" };
  if (path.startsWith("/api/pages/")) {
    const [, , , version, source] = path.split("/");
    const scope = catalogScopeForSource(source ?? "");
    if (!scope) return NextResponse.json({ error: "invalid source" }, { status: 400, headers: privateHeaders });
    try {
      const response = await fetch(`${process.env.API_INTERNAL_URL}/api/public/catalog-policy?scope=${encodeURIComponent(scope)}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error("catalog policy unavailable");
      const current = await response.json() as { version: string };
      if (version !== current.version) return NextResponse.json({ error: "snapshot_expired" }, { status: 409, headers: privateHeaders });
      return NextResponse.next();
    } catch { return NextResponse.json({ error: "policy_unavailable" }, { status: 503, headers: privateHeaders }); }
  }
  if (!match) return new NextResponse("Not found", { status: 404, headers: privateHeaders });
  const slug = match[2]!;
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL}/api/public/policy/${slug}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    if (response.status === 404) return new NextResponse("404 内容不存在", { status: 404, headers: privateHeaders });
    if (!response.ok) throw new Error("policy unavailable");
    const data = await response.json() as { revision: string };
    if (!/^[a-f0-9-]{36}$/.test(data.revision)) throw new Error("invalid policy");
    // 直达旧内部缓存 key 同样不能绕过门禁。
    if (match[1] !== data.revision) return new NextResponse("404 内容版本已撤销", { status: 404, headers: privateHeaders });
    return NextResponse.next();
  } catch {
    return new NextResponse("内容暂时无法验证，请稍后重试。", { status: 503, headers: privateHeaders });
  }
}
export const config = { matcher: ["/render/:path*", "/api/pages/:path*", "/api/images/:path*"] };
