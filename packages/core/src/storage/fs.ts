/**
 * 文件系统存储实现（E2E / 本地开发）。
 * 签名 URL 指向 API 的 /api/storage-object/<key>?expires=&sig=（HMAC-SHA256），
 * API 验签后直接回源字节并支持 Range —— 模拟 OSS 签名 GET 的行为。
 */
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ListedObject, MediaStorage, StoredObjectMeta } from "./interface";

export interface FsStorageOptions {
  root: string;
  signingSecret: string;
  /** 签名 URL 的公网 base，如 http://localhost:4000 */
  publicBaseUrl: string;
}

export class FsStorage implements MediaStorage {
  readonly kind = "fs" as const;
  constructor(private opts: FsStorageOptions) {}

  private resolve(key: string): string {
    const p = path.resolve(this.opts.root, key);
    const root = path.resolve(this.opts.root);
    if (!p.startsWith(root + path.sep)) throw new Error(`invalid key (path traversal): ${key}`);
    return p;
  }

  async head(key: string): Promise<StoredObjectMeta | null> {
    try {
      const st = await fs.stat(this.resolve(key));
      return { size: st.size, lastModified: st.mtime };
    } catch {
      return null;
    }
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async get(key: string): Promise<Buffer | null> {
    return this.read(key);
  }

  async list(prefix: string): Promise<ListedObject[]> {
    const dir = this.resolve(prefix);
    const out: ListedObject[] = [];
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }
    for (const name of entries) {
      const key = `${prefix.replace(/\/$/, "")}/${name}`;
      const st = await fs.stat(this.resolve(key));
      if (st.isFile()) out.push({ key, size: st.size, lastModified: st.mtime });
    }
    return out;
  }

  /** 验签逻辑与签发同置于此，API 的 storage-object 路由复用（同源不漂移）。 */
  static sign(secret: string, key: string, expiresEpochSec: number): string {
    return createHmac("sha256", secret).update(`${key}\n${expiresEpochSec}`).digest("hex");
  }

  async signGetUrl(key: string, ttlSec: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = FsStorage.sign(this.opts.signingSecret, key, expires);
    const base = this.opts.publicBaseUrl.replace(/\/$/, "");
    return `${base}/api/storage-object/${encodeURIComponent(key)}?expires=${expires}&sig=${sig}`;
  }

  verifyGetSignature(key: string, expiresEpochSec: number, sig: string): boolean {
    if (expiresEpochSec * 1000 < Date.now()) return false;
    const expected = FsStorage.sign(this.opts.signingSecret, key, expiresEpochSec);
    return expected === sig;
  }

  /** 供 API 路由读取字节（Range 支持在路由层实现）。 */
  async read(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
}
