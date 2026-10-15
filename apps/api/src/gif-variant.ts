import sharp from "sharp";
import { IMAGE_WEBP_QUALITY } from "@yoryon/config/image-variants";
import type { MediaStorage } from "@yoryon/core";
import { ApiError } from "./errors";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 8_000_000;
const MAX_FRAMES = 500;
const DEADLINE_MS = 12_000;

/** OSS format conversion drops GIF animation. Keep this bounded reader shared
 * by public cache fills and authorized media, with no source bytes cached here. */
export function createGifVariantReader(storage: MediaStorage, ttl: number) {
  let busy = false;
  const waiting: Array<{ start: () => void }> = [];

  async function acquire(signal: AbortSignal) {
    if (signal.aborted) throw new ApiError(503, "image_timeout", "图片处理已取消或超时");
    if (!busy) { busy = true; return; }
    if (waiting.length >= 4) throw new ApiError(503, "image_busy", "图片处理中，请稍后重试");
    await new Promise<void>((resolve, reject) => {
      const entry = { start: () => { signal.removeEventListener("abort", abort); resolve(); } };
      const abort = () => {
        const index = waiting.indexOf(entry);
        if (index !== -1) waiting.splice(index, 1);
        reject(new ApiError(503, "image_timeout", "图片处理超时，请稍后重试"));
      };
      waiting.push(entry);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  return async (key: string, width: number | undefined, requestSignal: AbortSignal) => {
    const deadline = Date.now() + DEADLINE_MS;
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(DEADLINE_MS)]);
    await acquire(signal);
    try {
      signal.throwIfAborted();
      const url = await storage.signGetUrl(key, ttl);
      const source = await fetch(url, { redirect: "error", signal });
      if (!source.ok || !source.body) {
        await source.body?.cancel();
        throw new ApiError(502, "image_unavailable", "图片暂时无法读取");
      }
      if (Number(source.headers.get("content-length")) > MAX_BYTES) {
        await source.body.cancel();
        throw new ApiError(413, "image_too_large", "GIF 最大为 8MiB");
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = source.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) throw new ApiError(413, "image_too_large", "GIF 最大为 8MiB");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      signal.throwIfAborted();
      const input = Buffer.concat(chunks, size);
      chunks.length = 0;
      const image = sharp(input, { animated: true, limitInputPixels: MAX_PIXELS, failOn: "error" });
      try {
        const metadata = await image.metadata();
        const pages = metadata.pages ?? 1;
        const pixels = (metadata.width ?? 0) * (metadata.pageHeight ?? metadata.height ?? 0) * pages;
        if (metadata.format !== "gif" || pixels === 0) throw new ApiError(422, "invalid_image", "GIF 无法解码");
        if (pixels > MAX_PIXELS || pages > MAX_FRAMES) throw new ApiError(413, "image_too_large", "GIF 超过帧数或总像素限制");
        signal.throwIfAborted();
        if (width) image.resize({ width, withoutEnlargement: true });
        // GIF can encode 65536 total plays; WebP's 16-bit field tops out at
        // 65535. Clamp that sole overflow instead of turning it into infinity.
        const loop = metadata.loop === undefined ? {} : { loop: Math.min(metadata.loop, 65_535) };
        const output = await image.webp({ quality: IMAGE_WEBP_QUALITY, effort: 4, ...loop })
          .timeout({ seconds: Math.min(5, Math.max(1, Math.ceil((deadline - Date.now()) / 1000))) }).toBuffer();
        signal.throwIfAborted();
        return output;
      } catch (error) {
        if (error instanceof ApiError || signal.aborted) throw error;
        if (error instanceof Error && /pixel limit/i.test(error.message)) throw new ApiError(413, "image_too_large", "GIF 超过总像素限制");
        if (error instanceof Error && /timeout|timed out/i.test(error.message)) throw new ApiError(503, "image_timeout", "图片处理超时，请稍后重试");
        throw new ApiError(422, "invalid_image", "GIF 无法解码");
      } finally { image.destroy(); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(signal.aborted ? 503 : 502, signal.aborted ? "image_timeout" : "image_unavailable", "图片暂时无法处理，请稍后重试");
    } finally {
      const next = waiting.shift();
      if (next) next.start(); else busy = false;
    }
  };
}

export type GifVariantReader = ReturnType<typeof createGifVariantReader>;
