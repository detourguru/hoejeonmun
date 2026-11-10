#!/usr/bin/env bash
# Run against a NEW disposable PostgreSQL container. Never point at production.
set -euo pipefail
container="${1:?Usage: scripts/test-review-db.sh disposable-container-name}"
run_sql() { docker --host=unix:///var/run/docker.sock exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1; }
run_sql < supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do run_sql < "$migration"; done
run_sql < supabase/tests/upload_moderation.sql
run_sql < supabase/tests/merge_user_show.sql
