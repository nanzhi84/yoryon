export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_BUCKETS = 64;
export interface SearchItem {
  slug: string; title: string; description: string; text: string;
  publishedAt: string | null; type: "article" | "post";
}
export interface MatchedText { before: string; match: string; after: string }
export interface SearchResult extends Omit<SearchItem, "text"> {
  titleMatch: MatchedText | null; snippet: MatchedText | null;
}
export interface SearchResponse {
  request: number; query: string; page: number; total: number; items: SearchResult[]; error?: string;
}
export function bucketFor(gram: string) {
  let value = 2166136261;
  for (const char of gram) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return (value >>> 0) % SEARCH_BUCKETS;
}
// /iu also matches long-s against ASCII s and Kelvin sign against ASCII k.
// Other cased non-ASCII queries conservatively skip pruning; exact /iu matching remains authoritative.
export const indexText = (text: string) => text.toLowerCase().replaceAll("\u017f", "s");
export function queryGrams(query: string): string[] | null {
  if ([...query].some(c => c.codePointAt(0)! > 127 && c.toLowerCase() !== c.toUpperCase())) return null;
  const points = [...indexText(query)];
  if (points.length === 1) return ["1" + points[0]];
  const at = [0, Math.floor((points.length - 2) / 2), points.length - 2];
  return [...new Set(at.map(i => "2" + points[i] + points[i + 1]))];
}
export function indexGrams(text: string) {
  const points = [...indexText(text)];
  const grams = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    grams.add("1" + points[i]);
    if (i + 1 < points.length) grams.add("2" + points[i] + points[i + 1]);
  }
  return grams;
}
export function literalPattern(query: string, global = false) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), global ? "giu" : "iu");
}
export function matchText(text: string, pattern: RegExp, excerpt = false): MatchedText | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const hitStart = match.index, hitEnd = hitStart + match[0].length;
  let start = 0, end = text.length;
  if (excerpt) {
    start = Math.max(0, hitStart - 45);
    const next = pattern.exec(text.slice(hitStart + 1));
    end = Math.min(text.length, hitEnd + 65, next ? Math.max(hitEnd, hitStart + 1 + next.index) : Infinity);
    if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start]!)) start++;
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
  }
  return { before: `${start > 0 ? "…" : ""}${text.slice(start, hitStart)}`, match: match[0], after: `${text.slice(hitEnd, end)}${end < text.length ? "…" : ""}` };
}
