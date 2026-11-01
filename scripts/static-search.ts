import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SEARCH_BUCKETS, bucketFor, indexGrams, type SearchItem } from "../apps/web/lib/search/format";

// Only public projections enter these files. Each ordinary shard has a bounded byte target;
// an individual long document remains whole so arbitrary substring matches cannot cross an artificial boundary.
export async function writeSearch(directory: string, items: Iterable<SearchItem>) {
  await mkdir(directory, { recursive: true });
  const buckets = Array.from({ length: SEARCH_BUCKETS }, () => new Map<string, number[]>());
  let shard: SearchItem[] = [], bytes = 0, count = 0;
  async function flush() {
    if (!shard.length) return;
    const grams = new Set<string>();
    for (const item of shard)
      for (const text of [item.title, item.description, item.text])
        for (const gram of indexGrams(text)) grams.add(gram);
    for (const gram of grams) {
      const bucket = buckets[bucketFor(gram)]!;
      const posting = bucket.get(gram);
      if (posting) posting.push(count); else bucket.set(gram, [count]);
    }
    await writeFile(join(directory, `shard-${count++}.json`), JSON.stringify(shard));
    shard = []; bytes = 0;
  }
  for (const item of items) {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > 64 * 1024) await flush();
    shard.push(item); bytes += size;
  }
  await flush();
  for (let i = 0; i < buckets.length; i++)
    await writeFile(join(directory, `index-${i}.json`), JSON.stringify(Object.fromEntries(buckets[i]!)));
  await writeFile(join(directory, "manifest.json"), JSON.stringify({ schema: 1, shards: count, buckets: SEARCH_BUCKETS }));
  return count;
}
