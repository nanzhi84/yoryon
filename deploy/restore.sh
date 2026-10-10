#!/usr/bin/env bash
# 数据库恢复：从 backup.sh 产出的 .dump.gz 恢复。
# 用法：./restore.sh backups/yoryon-20260101-000000.dump.gz
set -euo pipefail

cd "$(dirname "$0")"
FILE=${1:?用法: ./restore.sh <backup.dump.gz>}

echo "!! 将覆盖当前 yoryon 数据库，确认？(输入 yes 继续)"
read -r CONFIRM
[ "$CONFIRM" = "yes" ] || exit 1

docker compose exec -T postgres psql -U yoryon -d yoryon -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='yoryon' AND pid <> pg_backend_pid();"
docker compose exec -T postgres psql -U yoryon -d yoryon -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c "$FILE" | docker compose exec -T postgres pg_restore -U yoryon -d yoryon --no-owner --no-privileges
echo "restored from $FILE"
