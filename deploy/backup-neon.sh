#!/usr/bin/env bash
# Run as root on the production host. Backups contain private data: keep 0700/0600.
set -euo pipefail
umask 077
exec 9>/run/lock/yoryon-backup.lock
flock -n 9 || exit 0
backup_root=/var/backups/yoryon
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$backup_root/$backup_stamp"
mkdir -p "$backup_dir"
trap 'rm -f "$backup_dir/database.sql.gz.tmp" "$backup_dir/media.tar.gz.tmp"' EXIT
docker run --rm --env-file /etc/yoryon/migrate.env \
  -v /etc/ssl/certs/ca-certificates.crt:/etc/ssl/certs/ca-certificates.crt:ro \
  -e PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt postgres:16 \
  sh -c 'pg_dump --dbname="$DATABASE_URL" --no-owner --no-acl' \
  | gzip > "$backup_dir/database.sql.gz.tmp"
mv "$backup_dir/database.sql.gz.tmp" "$backup_dir/database.sql.gz"
tar -C /var/lib/yoryon -czf "$backup_dir/media.tar.gz.tmp" media
mv "$backup_dir/media.tar.gz.tmp" "$backup_dir/media.tar.gz"
(cd "$backup_dir" && sha256sum database.sql.gz media.tar.gz > SHA256SUMS)
touch "$backup_dir/COMPLETE"
# Only completed backup directories older than 7 days are eligible for removal.
find "$backup_root" -mindepth 2 -maxdepth 2 -name COMPLETE -mtime +7 -print0 \
  | while IFS= read -r -d '' marker; do rm -rf -- "$(dirname "$marker")"; done
printf 'backup completed: %s\n' "$backup_stamp"
