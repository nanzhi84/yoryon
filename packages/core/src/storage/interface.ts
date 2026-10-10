/**
 * 存储接口抽象（架构 §13）：生产 = ali-oss；E2E/本地 = 文件系统模拟。
 * 该接口仅服务测试与环境隔离，不是插件机制。
 */
import { MEDIA_BYTES_CACHE_CONTROL } from "@yoryon/config";

export interface StoredObjectMeta {
  size: number;
  lastModified: Date;
}

export interface ListedObject extends StoredObjectMeta {
  key: string;
}

export interface MediaStorage {
  readonly kind: "oss" | "fs";
  head(key: string): Promise<StoredObjectMeta | null>;
  /** 上传幂等（同 key 覆盖）。写入 Cache-Control: private, max-age=604800（内容寻址不可变）。 */
  put(key: string, data: Buffer, opts: { contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
  /** 分页列举 prefix 下全部对象（GC 用） */
  list(prefix: string): Promise<ListedObject[]>;
  /** 生成短期签名 GET URL（TTL 秒）。 */
  signGetUrl(key: string, ttlSec: number): Promise<string>;
}

export const BYTES_CACHE_CONTROL = MEDIA_BYTES_CACHE_CONTROL;

export function isValidMediaKey(key: string): boolean {
  return /^media\/[a-f0-9]{64}\.[a-z0-9]{1,10}$/.test(key);
}

/** 由文件路径推导内容寻址 key：media/<sha256>.<ext>（ADR-0006） */
export async function contentAddressedKey(sha256Hex: string, filename: string): Promise<string> {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "bin";
  return `media/${sha256Hex}.${ext.replace(/[^a-z0-9]/g, "") || "bin"}`;
}
