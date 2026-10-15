#!/bin/bash
# Concurrency: a free player with 1 start left fires 12 parallel start_game calls with different tab keys.
# Exactly one may succeed (the conditional upsert on daily_usage serialises on the row lock).
set -e
DB=$1; PSQL="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-55432} -U postgres -d $DB -qtA"
U=00000000-0000-0000-0000-0000000000dd
$PSQL -c "insert into auth.users (id, email, email_confirmed_at) values ('$U', 'd@example.test', now())" >/dev/null
$PSQL -c "insert into public.daily_usage (user_id, usage_date, starts) values ('$U', public.utc_today(), 2)" >/dev/null
for i in $(seq 1 12); do
  ( $PSQL -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$U\"}', false); select public.start_game('runner', 'par-key-$i') ->> 'allowed';" | tail -1 > /tmp/pgt/c_$i.out ) &
done
wait
OK=$(cat /tmp/pgt/c_*.out | grep -c true || true); rm -f /tmp/pgt/c_*.out
STARTS=$($PSQL -c "select starts from public.daily_usage where user_id = '$U'")
echo "concurrency: allowed=$OK starts=$STARTS"
[ "$OK" = "1" ] && [ "$STARTS" = "3" ] || { echo "FAIL: concurrent starts exceeded the limit"; exit 1; }
echo "ok - 12 parallel starts with 1 slot left → exactly 1 allowed"
