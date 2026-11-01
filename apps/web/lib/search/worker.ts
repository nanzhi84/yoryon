import { SEARCH_BUCKETS, SEARCH_PAGE_SIZE, bucketFor, queryGrams, literalPattern, matchText, type SearchItem, type SearchResult, type SearchResponse } from "./format";

type Request = { request: number; root: string; query: string; page: number; reload?: boolean };
const scope = self as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage: (v: SearchResponse) => void };
let active: AbortController | undefined;
let generation = 0;
let previous: { root: string; query: string; items: SearchResult[] } | undefined;
const cache = new Map<string, { value: unknown; bytes: number }>();
let cacheBytes = 0;

async function json(path: string, signal: AbortSignal, reload: boolean): Promise<unknown> {
  const cached = cache.get(path);
  if (cached && !reload) { cache.delete(path); cache.set(path, cached); return cached.value; }
  const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), cache: reload ? "reload" : "force-cache" });
  if (!response.ok) throw new Error("搜索数据加载失败，请重试。");
  const text = await response.text();
  signal.throwIfAborted();
  const value: unknown = JSON.parse(text);
  const bytes = text.length * 2;
  if (bytes <= 8 * 1024 * 1024) {
    if (cached) { cacheBytes -= cached.bytes; cache.delete(path); }
    while (cacheBytes + bytes > 8 * 1024 * 1024 && cache.size) {
      const key = cache.keys().next().value!;
      cacheBytes -= cache.get(key)!.bytes; cache.delete(key);
    }
    cache.set(path, { value, bytes }); cacheBytes += bytes;
  }
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("搜索数据格式无效，请刷新页面。");
  return value as Record<string, unknown>;
}
function searchItems(value: unknown): SearchItem[] {
  if (!Array.isArray(value)) throw new Error("搜索数据无法读取，请刷新后重试。");
  for (const item of value) {
    const c = record(item);
    if (typeof c.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(c.slug) ||
      !["title", "description", "text"].every(k => typeof c[k] === "string") ||
      (c.publishedAt !== null && typeof c.publishedAt !== "string") ||
      (c.type !== "article" && c.type !== "post")) throw new Error("搜索数据无法读取，请刷新后重试。");
  }
  return value as SearchItem[];
}
async function search(root: string, query: string, signal: AbortSignal, reload: boolean) {
  const manifest = record(await json(`${root}/manifest.json`, signal, reload));
  if (manifest.schema !== 1 || manifest.buckets !== SEARCH_BUCKETS || !Number.isSafeInteger(manifest.shards) || Number(manifest.shards) < 0)
    throw new Error("搜索数据已更新，请刷新页面。");
  const count = Number(manifest.shards);
  const grams = queryGrams(query);
  let candidates = Array.from({ length: count }, (_, i) => i);
  if (grams) {
    const keys = [...new Set(grams.map(bucketFor))];
    const entries = await Promise.all(keys.map(async k => [k, record(await json(`${root}/index-${k}.json`, signal, reload))] as const));
    const buckets = new Map(entries);
    let allowed: Set<number> | undefined;
    for (const gram of grams) {
      const ids = buckets.get(bucketFor(gram))![gram] ?? [];
      if (!Array.isArray(ids) || ids.some(n => !Number.isInteger(n) || n < 0 || n >= count)) throw new Error("搜索数据无法读取，请刷新后重试。");
      const next = new Set<number>(ids);
      allowed = allowed ? new Set([...allowed].filter(n => next.has(n))) : next;
    }
    candidates = [...(allowed ?? [])].sort((a, b) => a - b);
  }
  const pattern = literalPattern(query);
  const found = new Array<SearchResult[]>(candidates.length);
  let cursor = 0;
  async function run() {
    while (cursor < candidates.length) {
      signal.throwIfAborted();
      const slot = cursor++;
      const rows = searchItems(await json(`${root}/shard-${candidates[slot]}.json`, signal, reload));
      const results: SearchResult[] = [];
      for (const [i, item] of rows.entries()) {
        const titleMatch = matchText(item.title, pattern);
        const snippet = matchText(item.text, pattern, true) ?? matchText(item.description, pattern, true);
        if (titleMatch || snippet) {
          const { text: _text, ...metadata } = item;
          results.push({ ...metadata, titleMatch, snippet });
        }
        if (i % 32 === 31) { await new Promise(resolve => setTimeout(resolve, 0)); signal.throwIfAborted(); }
      }
      found[slot] = results;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  await Promise.all([run(), run(), run()]);
  return found.flat();
}
scope.onmessage = ({ data }) => {
  active?.abort();
  const sequence = ++generation;
  const controller = new AbortController();
  active = controller;
  void (async () => {
    try {
      if (!/^\/data\/static\/[a-f0-9]{20}\/search$/.test(data.root)) throw new Error("搜索路径无效。");
      const query = data.query.trim().slice(0, 120);
      if (!query) { scope.postMessage({ request: data.request, query, page: 1, total: 0, items: [] }); return; }
      const items = !data.reload && previous?.root === data.root && previous.query === query
        ? previous.items : await search(data.root, query, controller.signal, data.reload === true);
      if (sequence !== generation) return;
      previous = { root: data.root, query, items };
      const page = Math.min(Math.max(1, Number.isSafeInteger(data.page) ? data.page : 1), Math.max(1, Math.ceil(items.length / SEARCH_PAGE_SIZE)));
      scope.postMessage({ request: data.request, query, page, total: items.length, items: items.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE) });
    } catch (error) {
      if (sequence === generation && !controller.signal.aborted) {
        controller.abort();
        scope.postMessage({ request: data.request, query: data.query, page: data.page, total: 0, items: [], error: error instanceof Error ? error.message : "搜索失败，请重试。" });
      }
    }
  })();
};
