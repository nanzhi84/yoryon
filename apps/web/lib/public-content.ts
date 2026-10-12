import { publicFetch } from "./api";
import type { ContentDetail } from "./types";

export async function getPublicContent(slug: string, revision: string): Promise<ContentDetail | null> {
  const response = await publicFetch(`/api/public/contents/${slug}?revision=${revision}`, { revalidate: 86400, tags: [`content:${slug}`] });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public content API ${response.status}`);
  const content = await response.json() as ContentDetail;
  if (content.revision !== revision) return null;
  return content;
}
