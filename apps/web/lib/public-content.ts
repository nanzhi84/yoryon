import { publicFetch, publicFetchNoStore } from "./api";
import type { ContentDetail } from "./types";

export async function getPublicContent(slug: string, revision: string): Promise<ContentDetail | null> {
  const response = await publicFetch(`/api/public/contents/${slug}?protocol=entry-v5&revision=${revision}`, { revalidate: 86400, tags: [`content:${slug}`] });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public content API ${response.status}`);
  const content = await response.json() as ContentDetail;
  if (content.revision !== revision) return null;
  return content;
}

/** Gate each canonical read before using a revision-keyed public snapshot. */
export async function getCurrentPublicContent(slug: string): Promise<ContentDetail | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  const response = await publicFetchNoStore(`/api/public/policy/${slug}`, { signal: AbortSignal.timeout(3000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`content policy API ${response.status}`);
  const policy: unknown = await response.json();
  if (!policy || typeof policy !== "object" || !("revision" in policy) ||
      typeof policy.revision !== "string" || !/^[a-f0-9-]{36}$/.test(policy.revision)) {
    throw new Error("Invalid content revision");
  }
  return getPublicContent(slug, policy.revision);
}
