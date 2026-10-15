import { publicFetch } from "@/lib/api";

export const dynamic = "force-static";
export const revalidate = 86400;
export async function GET(_request: Request, { params }: { params: Promise<{ version: string; source: string; cursor: string }> }) {
  const { version, source, cursor } = await params;
  if (!/^[a-f0-9-]{36}$/.test(version) || !/^[a-z0-9][a-z0-9-]*$/.test(source) || !/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) return Response.json({ error: "invalid snapshot" }, { status: 400 });
  if (source !== "feed" && source !== "post-feed" && source !== "paid-feed" && source !== "member-feed" && !source.startsWith("tag-")) return Response.json({ error: "invalid source" }, { status: 400 });
  const tag = source.slice(4);
  const path = source === "feed" ? "/api/feed" : source === "post-feed" ? "/api/post-feed" : source === "paid-feed" ? "/api/paid-feed" : source === "member-feed" ? "/api/member-feed" : `/api/tags/${tag}`;
  const query = `?protocol=entry-v5&version=${version}${cursor === "start" ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
  const res = await publicFetch(path + query, { revalidate: 86400, tags: [(source === "feed" || source === "post-feed" || source === "paid-feed" || source === "member-feed") ? "feed" : `tag:${tag}`] });
  // 预期错误（invalid_cursor / snapshot_expired）透传状态与错误码，私有不缓存；客户端据此引导刷新而非 500
  if (res.status === 400 || res.status === 409) {
    return Response.json(await res.json(), { status: res.status, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!res.ok) throw new Error(`snapshot API ${res.status}`);
  return Response.json(await res.json(), { headers: { "Cache-Control": "public, max-age=0, s-maxage=86400" } });
}
