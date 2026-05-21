#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: bash scripts/run-with-db.sh <local|online> <command...>" >&2
  exit 1
fi

TARGET="$1"
shift

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

case "$TARGET" in
  local)
    DB_URL="${DATABASE_URL_LOCAL:-${DATABASE_URL:-}}"
    ;;
  online)
    DB_URL="${DATABASE_URL_ONLINE:-}"
    ;;
  *)
    echo "Unknown target: $TARGET (expected: local or online)" >&2
    exit 1
    ;;
esac

if [[ -z "${DB_URL:-}" ]]; then
  echo "Missing database URL for target '$TARGET'. Please set DATABASE_URL_LOCAL or DATABASE_URL_ONLINE in .env." >&2
  exit 1
fi

DATABASE_URL="$DB_URL" "$@"
