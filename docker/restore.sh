#!/usr/bin/env bash
# Usage: ./restore.sh ../backups/invoices-XXXX.sql.gz [compose-file]
set -euo pipefail
cd "$(dirname "$0")"
FILE="$1"; COMPOSE_FILE="${2:-docker-compose.prod.yml}"
gunzip -c "$FILE" | docker compose -f "$COMPOSE_FILE" exec -T db psql -v ON_ERROR_STOP=1 --single-transaction -U invoices -d invoices
echo "OK: restored $FILE"
