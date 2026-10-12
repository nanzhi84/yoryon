import { IMAGE_BROWSER_CACHE_CONTROL, IMAGE_CDN_CACHE_CONTROL, PUBLIC_IMAGE_MIMES, validImageVariant } from "@yoryon/config/image-variants";

/** Byte cache contains no session data or expiring OSS URL. Edge policy guards
 * every read; the API rechecks policy on cold fills to close the fill race. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await params;
  const privateHeaders = { "Cache-Control": "private, no-store" };
  if (!/^[a-f0-9-]{36}$/.test(id)) return Response.json({ error: "not_found" }, { status: 404, headers: privateHeaders });
  if (!validImageVariant(variant) || new URL(request.url).search) return Response.json({ error: "invalid_variant" }, { status: 400, headers: privateHeaders });
  try {
    const source = await fetch(`${process.env.API_INTERNAL_URL}/api/public/images/${id}/${variant}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!source.ok) return Response.json({ error: "image_unavailable" }, { status: source.status, headers: privateHeaders });
    const mime = source.headers.get("content-type") ?? "";
    const etag = source.headers.get("etag") ?? "";
    if (!PUBLIC_IMAGE_MIMES.includes(mime) || !/^"image-v1-[a-f0-9]{64}-(original|320|640|960|1280)"$/.test(etag)) throw new Error("invalid image response");
    return new Response(source.body, { headers: {
      "Content-Type": mime, "ETag": etag,
      "Cache-Control": IMAGE_BROWSER_CACHE_CONTROL,
      "Vercel-CDN-Cache-Control": IMAGE_CDN_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    } });
  } catch {
    return Response.json({ error: "image_unavailable" }, { status: 502, headers: privateHeaders });
  }
}
export const dynamic = "force-dynamic";
// The private OSS and API origin are in Singapore; cold cache fills stay nearby.
export const preferredRegion = "sin1";
