#!/bin/bash
# Fresh database → Supabase shim → all migrations → SQL test suite. Needs a local Postgres (see test/db/README.md).
set -e
cd "$(dirname "$0")/../.."
PSQL="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-55432} -U postgres -v ON_ERROR_STOP=1 -q"
DB=${DB:-inoa_test}
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d $DB -f test/db/supabase_shim.sql
for f in supabase/migrations/*.sql; do echo "migrate $f"; $PSQL -d $DB -f "$f"; done
$PSQL -d $DB -f test/db/tests.sql
bash test/db/concurrency.sh "$DB"
echo DB_TESTS_PASSED
