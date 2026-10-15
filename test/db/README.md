# Database tests (schema, RLS, limits, rewards, billing events, admin)

Runs the real `supabase/migrations/*.sql` on a plain local Postgres 16 with a small Supabase shim (`supabase_shim.sql`:
roles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()` from the JWT-claims setting, broad default grants
that the migrations must revoke). Then `tests.sql` (94 assertions) and `concurrency.sh` (12 parallel starts, 1 slot left).

```bash
# one-time: a throwaway cluster owned by a non-root user
useradd -m pgt; mkdir -p /tmp/pgt && chown pgt /tmp/pgt && chmod 777 /tmp/pgt
su pgt -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pgt/data -U postgres --auth=trust"
su pgt -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgt/data -o '-p 55432 -k /tmp/pgt' -l /tmp/pgt/log start"
npm run test:db        # → DB_TESTS_PASSED
```
Against a Supabase dev project instead: apply the migrations with the Supabase CLI and run the same `tests.sql` there (skip the shim).
