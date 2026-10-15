#!/bin/bash
# Fresh database with the Supabase shim + all migrations (used by run.sh and the platform e2e test).
set -e
cd "$(dirname "$0")/../.."
PSQL="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-55432} -U postgres -v ON_ERROR_STOP=1 -q"
DB=${1:-${DB:-inoa_test}}
$PSQL -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
$PSQL -d $DB -f test/db/supabase_shim.sql >/dev/null
for f in supabase/migrations/*.sql; do $PSQL -d $DB -f "$f" >/dev/null; done
echo "db $DB ready"
