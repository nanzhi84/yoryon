import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { and, eq, isNull, or } from "drizzle-orm";
import { mediaAssets, type Database } from "@yoryon/db";
import { probeImageDimensions } from "./image";
import { contentAddressedKey, type MediaStorage } from "./storage";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export interface PreparedMedia {
  data: Buffer;
  ossKey: string;
  mime: string;
  size: number;
  dims: { width: number; height: number } | null;
}

/** Upload the exact bytes that were hashed, sharing one contract for work and collection covers. */
export async function prepareLocalMedia(filename: string, mime: string): Promise<PreparedMedia> {
  const data = await fs.readFile(filename);
  const sha256 = createHash("sha256").update(data).digest("hex");
  return { data, size: data.byteLength, ossKey: await contentAddressedKey(sha256, filename), mime, dims: probeImageDimensions(data, mime) };
}

async function retry<T>(operation: () => Promise<T>, action: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await operation(); }
    catch (error) { last = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1))); }
  }
  throw new Error(`${action} 失败（重试 3 次）: ${String(last)}`);
}

export async function uploadPreparedMedia(storage: MediaStorage, file: PreparedMedia): Promise<"uploaded" | "existing"> {
  const head = await retry(() => storage.head(file.ossKey), "媒体 HEAD");
  if (head) return "existing";
  await retry(() => storage.put(file.ossKey, file.data, { contentType: file.mime }), "媒体 PUT");
  return "uploaded";
}

export async function upsertPreparedMedia(tx: Tx, file: Omit<PreparedMedia, "data">): Promise<string> {
  await tx.insert(mediaAssets).values({ ossKey: file.ossKey, mimeType: file.mime, sizeBytes: file.size,
    width: file.dims?.width ?? null, height: file.dims?.height ?? null }).onConflictDoNothing({ target: mediaAssets.ossKey });
  if (file.dims) await tx.update(mediaAssets).set(file.dims).where(and(eq(mediaAssets.ossKey, file.ossKey),
    or(isNull(mediaAssets.width), isNull(mediaAssets.height))));
  const [asset] = await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.ossKey, file.ossKey)).limit(1);
  return asset!.id;
}
