/**
 * 阿里云 OSS 存储实现（生产）。统一私有桶（ADR-0006）：
 * - 上传写入 Cache-Control: private, max-age=604800（内容寻址不可变）；
 * - 仅签发短期签名 GET URL；桶写/删权限只授予 CLI 发布身份（ADR §12 凭证分离）。
 */
import OSS from "ali-oss";
import { BYTES_CACHE_CONTROL, type ListedObject, type MediaStorage, type StoredObjectMeta } from "./interface";

export interface OssStorageOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string | undefined;
}

export class OssStorage implements MediaStorage {
  readonly kind = "oss" as const;
  private client: OSS;

  constructor(opts: OssStorageOptions) {
    this.client = new OSS({
      region: opts.region,
      bucket: opts.bucket,
      accessKeyId: opts.accessKeyId,
      accessKeySecret: opts.accessKeySecret,
      secure: true,
      ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
    });
  }

  async head(key: string): Promise<StoredObjectMeta | null> {
    try {
      const res = await this.client.head(key);
      const headers = res.res.headers as Record<string, string | undefined>;
      const size = Number(headers["content-length"] ?? res.meta?.size ?? 0);
      const lm = headers["last-modified"];
      return { size, lastModified: lm ? new Date(String(lm)) : new Date(0) };
    } catch (err: any) {
      if (err?.code === "NoSuchKey" || err?.status === 404) return null;
      throw err;
    }
  }

  async put(key: string, data: Buffer, opts: { contentType: string }): Promise<void> {
    await this.client.put(key, data, {
      mime: opts.contentType,
      headers: {
        "Cache-Control": BYTES_CACHE_CONTROL,
        "Content-Type": opts.contentType,
      },
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key);
  }

  async list(prefix: string): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    let marker: string | undefined;
    do {
      const res: OSS.ListObjectResult = await this.client.list({ prefix, "max-keys": 1000, ...(marker ? { marker } : {}) }, {});
      for (const obj of res.objects ?? []) {
        out.push({ key: obj.name, size: obj.size, lastModified: new Date(obj.lastModified) });
      }
      marker = res.isTruncated ? res.nextMarker : undefined;
    } while (marker);
    return out;
  }

  async signGetUrl(key: string, ttlSec: number): Promise<string> {
    return this.client.signatureUrl(key, { expires: ttlSec });
  }
}
