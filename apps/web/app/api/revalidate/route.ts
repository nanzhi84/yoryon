import { revalidatePath, revalidateTag } from "next/cache";
import { validCacheEvent } from "@yoryon/config/cache";
import { cacheSignature, verifyCacheSignature } from "@yoryon/config/cache-signing";
import { readBodyCapped } from "@/lib/bff";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = await readBodyCapped(request, 16384);
  const secret = process.env.CACHE_REVALIDATE_SECRET;
  const headers = { "Cache-Control": "private, no-store" };
  if (body === null || !verifyCacheSignature(secret, request.headers.get("x-cache-time"), request.headers.get("x-cache-signature"), body)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  let event: unknown;
  try { event = JSON.parse(body); } catch { return Response.json({ error: "invalid event" }, { status: 400, headers }); }
  if (!validCacheEvent(event)) return Response.json({ error: "invalid targets" }, { status: 400, headers });
  const verify = async (acknowledge: boolean) => {
    const time = String(Date.now());
    const payload = JSON.stringify({ id: event.id, payload: body, acknowledge });
    const res = await fetch(`${process.env.API_INTERNAL_URL}/api/cache/event`, { method: "POST", body: payload, headers: { "content-type": "application/json", "x-cache-time": time, "x-cache-signature": cacheSignature(secret!, time, payload) }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`event verification ${res.status}`);
    return await res.json() as { invalidated: boolean };
  };
  try {
    const known = await verify(false);
    if (!known.invalidated) {
      for (const tag of event.tags) revalidateTag(tag);
      for (const path of event.paths) revalidatePath(path);
      await verify(true);
    }
    return Response.json({ eventId: event.id, invalidated: true }, { headers });
  } catch {
    return Response.json({ error: "invalidation unavailable" }, { status: 503, headers });
  }
}
