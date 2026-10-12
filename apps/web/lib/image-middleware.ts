import { NextResponse, type NextRequest } from "next/server";
import { IMAGE_BROWSER_CACHE_CONTROL, imageEtag, validImageVariant } from "@yoryon/config/image-variants";

/** Runs before even a CDN HIT or a browser conditional response. */
export async function imageMiddleware(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const match = /^\/api\/images\/v1\/([a-f0-9-]{36})\/(original|\d+)$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  if (!validImageVariant(match[2]!) || request.nextUrl.search) return NextResponse.json({ error: "invalid_variant" }, { status: 400, headers });
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL}/api/public/image-policy/${match[1]}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    if (response.status === 403 || response.status === 404) return NextResponse.json({ error: "forbidden" }, { status: response.status, headers });
    if (!response.ok) throw new Error("image policy unavailable");
    const data = await response.json() as { hash: string };
    if (!/^[a-f0-9]{64}$/.test(data.hash)) throw new Error("invalid image policy");
    const etag = imageEtag(data.hash, match[2]!);
    if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { "ETag": etag, "Cache-Control": IMAGE_BROWSER_CACHE_CONTROL, "Vercel-CDN-Cache-Control": "no-store" } });
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "policy_unavailable" }, { status: 503, headers });
  }
}
