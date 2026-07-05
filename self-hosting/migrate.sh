#!/usr/bin/env bash
# =============================================================================
# Applies the TamFam app schema (../supabase/migrations/*.sql) to the running
# self-hosted Postgres. Run this ONCE after `docker compose up -d`, once the db
# and auth containers are healthy — our migrations reference auth.users, which
# GoTrue creates at runtime.
#
# Safe to re-run: individual migrations are not guarded, so only run again on a
# fresh database. For iterative changes, add new numbered migration files.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

# Load POSTGRES_PASSWORD from .env.
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

DB_SERVICE=${DB_SERVICE:-db}
MIGRATIONS_DIR=../supabase/migrations

echo "Waiting for the auth schema (auth.users) to be ready..."
for i in $(seq 1 60); do
  if docker compose exec -T "$DB_SERVICE" \
       psql -U postgres -d postgres -tAc \
       "select to_regclass('auth.users') is not null" | grep -q t; then
    echo "auth.users is present."
    break
  fi
  if [[ "$i" == "60" ]]; then
    echo "Timed out waiting for auth.users. Is the auth container healthy?" >&2
    exit 1
  fi
  sleep 2
done

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "Applying $(basename "$f")..."
  docker compose exec -T "$DB_SERVICE" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$f"
done

echo "All migrations applied. Now promote your first admin (see README)."
