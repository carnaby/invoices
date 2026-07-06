#!/usr/bin/env bash
# Usage: ./backup.sh [compose-file] — dumps DB to ../backups/invoices-YYYYmmdd-HHMMSS.sql.gz
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
mkdir -p ../backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U invoices invoices | gzip > "../backups/invoices-$STAMP.sql.gz"
echo "OK: backups/invoices-$STAMP.sql.gz"
