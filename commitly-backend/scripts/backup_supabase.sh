#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR=${1:-backups}
CONNECTION_URL=${SUPABASE_DB_URL:-${DATABASE_URL:-}}

if [[ -z "${CONNECTION_URL}" ]]; then
  echo "Either SUPABASE_DB_URL or DATABASE_URL must be set" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
TARGET="${OUTPUT_DIR}/supabase_${TIMESTAMP}.sql"

export PGPASSWORD="${PGPASSWORD:-}"
export PGSSLMODE=${PGSSLMODE:-require}

pg_dump --no-owner --format=plain --file="${TARGET}" "${CONNECTION_URL}"

echo "Created Supabase backup at ${TARGET}"
