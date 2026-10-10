#!/usr/bin/env bash
# 数据库备份：pg_dump | gzip → 本地 backups/，可选上传 OSS 私有备份桶（保留 30 天由桶 lifecycle 管理）。
# 用法（ECS 上，deploy 目录）：
#   ./backup.sh                  # 备份到 ./backups
#   OSS_BACKUP_BUCKET=my-backup OSSUTIL_BIN=ossutil ./backup.sh   # 同时上传 OSS
set -euo pipefail

cd "$(dirname "$0")"
TS=$(date +%Y%m%d-%H%M%S)
OUT_DIR=${BACKUP_DIR:-./backups}
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/yoryon-$TS.dump"

docker compose exec -T postgres pg_dump -U yoryon -Fc yoryon > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
gzip -9 "$OUT"
echo "backup written: $OUT.gz"

if [ -n "${OSS_BACKUP_BUCKET:-}" ] && [ -n "${OSSUTIL_BIN:-}" ]; then
  "$OSSUTIL_BIN" cp "$OUT.gz" "oss://$OSS_BACKUP_BUCKET/db/$(basename "$OUT.gz")"
  echo "uploaded to oss://$OSS_BACKUP_BUCKET/db/"
fi

# 本地保留最近 14 份
ls -1t "$OUT_DIR"/yoryon-*.dump.gz 2>/dev/null | tail -n +15 | xargs -r rm --
