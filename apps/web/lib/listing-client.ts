import { parseListing, type Listing } from "./listing";
const cache = new Map<string, { value: Listing; bytes: number }>();
let bytes = 0, running = 0;
const waiting = new Set<() => void>();
export function cachedListing(url: string) {
  const entry = cache.get(url);
  if (entry) { cache.delete(url); cache.set(url, entry); }
  return entry?.value;
}
export function cacheListing(url: string, value: Listing, size = JSON.stringify(value).length * 2) {
  const old = cache.get(url);
  if (old) { bytes -= old.bytes; cache.delete(url); }
  if (size > 8 * 1024 * 1024) return;
  while (cache.size && bytes + size > 8 * 1024 * 1024) {
    const key = cache.keys().next().value!;
    bytes -= cache.get(key)!.bytes; cache.delete(key);
  }
  cache.set(url, { value, bytes: size }); bytes += size;
}
async function acquire(signal: AbortSignal) {
  while (running >= 3) {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const ready = () => { waiting.delete(ready); signal.removeEventListener("abort", abort); resolve(); };
      const abort = () => { waiting.delete(ready); reject(signal.reason); };
      waiting.add(ready); signal.addEventListener("abort", abort, { once: true });
    });
  }
  signal.throwIfAborted(); running++;
}
export async function loadListing(url: string, expected: Listing, page: number, signal: AbortSignal, reload = false) {
  const cached = cachedListing(url);
  if (cached && !reload) return cached;
  await acquire(signal);
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), cache: reload ? "reload" : "force-cache" });
    if (!response.ok) throw new Error("后续内容加载失败，请重试。");
    const text = await response.text();
    signal.throwIfAborted();
    const value = parseListing(JSON.parse(text), expected, page);
    cacheListing(url, value, text.length * 2);
    return value;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error("后续内容加载失败，请重试。");
    throw error;
  } finally { running--; for (const ready of waiting) ready(); }
}
