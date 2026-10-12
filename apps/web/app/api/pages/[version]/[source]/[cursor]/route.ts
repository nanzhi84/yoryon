import { publicFetch } from "@/lib/api";

export const dynamic = "force-static";
export const revalidate = 86400;
export async function GET(_request: Request, { params }: { params: Promise<{ version: string; source: string; cursor: string }> }) {
  const { version, source, cursor } = await params;
  if (!/^[a-f0-9-]{36}$/.test(version) || !/^[a-z0-9][a-z0-9-]*$/.test(source) || !/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) return Response.json({ error: "invalid snapshot" }, { status: 400 });
  if (source !== "feed" && !source.startsWith("tag-")) return Response.json({ error: "invalid source" }, { status: 400 });
  const tag = source.slice(4);
  const path = source === "feed" ? "/api/feed" : `/api/tags/${tag}`;
  const query = `?version=${version}${cursor === "start" ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
  const res = await publicFetch(path + query, { revalidate: 86400, tags: [source === "feed" ? "feed" : `tag:${tag}`] });
  if (!res.ok) throw new Error(`snapshot API ${res.status}`);
  return Response.json(await res.json(), { headers: { "Cache-Control": "public, max-age=0, s-maxage=86400" } });
}
