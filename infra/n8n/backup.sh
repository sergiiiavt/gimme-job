#!/usr/bin/env bash
set -Eeuo pipefail

STACK_DIR="${STACK_DIR:-/opt/gimmejob-n8n}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gimmejob-n8n}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$STACK_DIR"
install -d -m 0700 "$BACKUP_DIR"

COMPOSE=(docker compose --env-file .env -f compose.yaml)

"${COMPOSE[@]}" exec -T postgres pg_dump -U n8n -d n8n \
  | gzip -9 > "$BACKUP_DIR/postgres-$STAMP.sql.gz"

docker run --rm \
  -v gimmejob-n8n_n8n_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.22 \
  tar -czf "/backup/n8n-data-$STAMP.tar.gz" -C /data .

install -m 0600 .env "$BACKUP_DIR/env-$STAMP"

find "$BACKUP_DIR" -type f -mtime "+$RETENTION_DAYS" -delete

echo "Backup completed: $STAMP"
