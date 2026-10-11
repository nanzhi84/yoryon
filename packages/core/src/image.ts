/**
 * 图片尺寸探测（F08）：媒体入库时探测一次，写入 media_assets.width/height，所有展示场景复用。
 * 仅处理 image/*（含 SVG）；探测失败返回 null（字段可空，不阻断发布）。
 */
import { imageSize } from "image-size";
import { and, eq, isNull, like, or } from "drizzle-orm";
import { mediaAssets, type Database } from "@yoryon/db";
import type { MediaStorage } from "./storage";

export interface ImageDimensions {
  width: number;
  height: number;
}

export function probeImageDimensions(data: Buffer, mimeType: string): ImageDimensions | null {
  if (!mimeType.startsWith("image/")) return null;
  try {
    const { width, height } = imageSize(new Uint8Array(data));
    if (!width || !height || width <= 0 || height <= 0) return null;
    return { width, height };
  } catch {
    return null;
  }
}

export interface BackfillDimensionsReport {
  /** 缺尺寸的图片资产数 */
  missing: number;
  updated: number;
  /** 存储对象缺失或探测失败（不阻断整体流程，可重跑） */
  failed: { ossKey: string; reason: string }[];
}

/**
 * 旧素材尺寸补刷（F08）：扫描缺 width/height 的图片资产，从存储读字节探测并回填。
 * dry-run（apply=false）只统计不写库；失败条目可安全重跑（仅更新仍缺尺寸的行）。
 */
export async function backfillImageDimensions(
  deps: { db: Database; storage: MediaStorage },
  opts: { apply: boolean },
): Promise<BackfillDimensionsReport> {
  const rows = await deps.db
    .select({ id: mediaAssets.id, ossKey: mediaAssets.ossKey, mimeType: mediaAssets.mimeType })
    .from(mediaAssets)
    .where(and(like(mediaAssets.mimeType, "image/%"), or(isNull(mediaAssets.width), isNull(mediaAssets.height))));

  const report: BackfillDimensionsReport = { missing: rows.length, updated: 0, failed: [] };
  for (const row of rows) {
    const data = await deps.storage.get(row.ossKey).catch((err: unknown) => {
      report.failed.push({ ossKey: row.ossKey, reason: `读取失败: ${String(err)}` });
      return null;
    });
    if (!data) {
      if (!report.failed.some((f) => f.ossKey === row.ossKey)) report.failed.push({ ossKey: row.ossKey, reason: "存储对象不存在" });
      continue;
    }
    const dims = probeImageDimensions(data, row.mimeType);
    if (!dims) {
      report.failed.push({ ossKey: row.ossKey, reason: "尺寸探测失败" });
      continue;
    }
    if (opts.apply) {
      await deps.db
        .update(mediaAssets)
        .set({ width: dims.width, height: dims.height })
        .where(and(eq(mediaAssets.id, row.id), or(isNull(mediaAssets.width), isNull(mediaAssets.height))));
    }
    report.updated += 1;
  }
  return report;
}
