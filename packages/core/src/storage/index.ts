import type { ApiEnv, CliEnv } from "@yoryon/config";
import type { MediaStorage } from "./interface";
import { FsStorage } from "./fs";
import { OssStorage } from "./oss";

/** 按环境创建存储实例（生产 oss / 本地与 E2E fs）。 */
export function createStorage(env: ApiEnv | CliEnv): MediaStorage {
  if (env.STORAGE_BACKEND === "oss") {
    return new OssStorage({
      region: env.OSS_REGION!,
      bucket: env.OSS_BUCKET!,
      accessKeyId: env.OSS_ACCESS_KEY_ID!,
      accessKeySecret: env.OSS_ACCESS_KEY_SECRET!,
      endpoint: env.OSS_ENDPOINT,
    });
  }
  return new FsStorage({
    root: env.FS_STORAGE_ROOT!,
    signingSecret: env.FS_STORAGE_SIGNING_SECRET!,
    publicBaseUrl: env.API_PUBLIC_URL,
  });
}

export * from "./interface";
export { FsStorage } from "./fs";
export { OssStorage } from "./oss";
