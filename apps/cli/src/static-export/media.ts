import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { protectedJson } from "./source";

interface Candidate {
  id: string;
  key: string;
  mimeType: string;
  bytes: number;
}

export async function exportAssets(
  items: Candidate[],
  config: string,
  directory: string,
  previous: string
) {
  const require = createRequire(import.meta.url);
  const OSS = require(
    require.resolve("ali-oss", {
      paths: [resolve(import.meta.dirname, "../../../../packages/core")],
    })
  );
  const credentials = await protectedJson(resolve(config, "oss-credentials.json"));
  const client = new OSS({
    region: credentials.region,
    bucket: credentials.bucket,
    ...credentials.api,
    secure: true,
    timeout: 60000,
  });
  await mkdir(directory, { recursive: true });
  const queue = [...items];
  const completed = new Map<
    string,
    { id: string; path: string; mimeType: string; bytes: number; sha256: string }
  >();
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      if (!/^media\/[a-f0-9]{64}\.[a-z0-9]+$/.test(item.key)) throw new Error("媒体对象名不合法");
      const hash = item.key.slice(6, 70);
      const extension = extname(item.key);
      const file = resolve(directory, `${item.id}${extension}`);
      let valid = false;
      try {
        const cached = resolve(previous, `${item.id}${extension}`);
        valid =
          (await stat(cached)).size === item.bytes &&
          createHash("sha256")
            .update(await readFile(cached))
            .digest("hex") === hash;
        if (valid) await copyFile(cached, file);
      } catch {
        /* A missing local file is downloaded below. */
      }
      if (!valid) {
        let downloaded = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await client.get(item.key, `${file}.tmp`);
            if (
              (await stat(`${file}.tmp`)).size !== item.bytes ||
              createHash("sha256")
                .update(await readFile(`${file}.tmp`))
                .digest("hex") !== hash
            )
              throw new Error("媒体校验失败");
            await rename(`${file}.tmp`, file);
            downloaded = true;
            break;
          } catch {
            if (attempt === 1) throw new Error("媒体下载或字节校验失败");
          }
        }
        if (!downloaded) throw new Error("媒体下载未完成");
      }
      completed.set(item.id, {
        id: item.id,
        path: `/media/${item.id}${extension}`,
        mimeType: item.mimeType,
        bytes: item.bytes,
        sha256: hash,
      });
    }
  }
  const results = await Promise.allSettled([worker(), worker(), worker()]);
  if (results.some((result) => result.status === "rejected"))
    throw new Error("媒体下载或字节校验失败");
  return items.map((item) => completed.get(item.id)!);
}
