-- Inoa Games platform SQL tests: RLS isolation, column grants, free-start limit, sessions, rewards, import, achievements,
-- billing events (idempotent, out-of-order), entitlement, admin authorization. Stops at the first broken expectation.
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin begin execute q; exception when others then raise notice 'ok - % [refused: %]', msg, sqlerrm; return; end; raise exception 'FAIL: % (statement succeeded: %)', msg, q; end $$;
create function t.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false) $$;
grant execute on all functions in schema t to anon, authenticated, service_role;
-- age a session so the minimum-round-time rule can be exercised without sleeping
create function t.age_session(sid uuid, secs int) returns void language sql security definer as $$ update public.ig_game_sessions set started_at = started_at - make_interval(secs => secs) where id = sid; update public.ig_session_rounds set created_at = created_at - make_interval(secs => secs) where session_id = sid $$;
grant execute on function t.age_session(uuid, int) to authenticated;
set client_min_messages = notice;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', now(), '{"display_name":"Ana <script>","app":"inoa"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', now(), '{"display_name":"Ben","app":"inoa"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', null, '{"app":"inoa"}'),
  ('00000000-0000-0000-0000-0000000000ff', 'owner@example.test', now(), '{"display_name":"Owner","app":"inoa"}'),
  ('00000000-0000-0000-0000-0000000000d0', 'other-app@example.test', now(), '{"full_name":"Someone from another app"}');
select t.ok((select count(*) from public.ig_profiles) = 4, 'signup trigger creates a profile per Inoa user');
select t.ok(not exists (select 1 from public.ig_profiles where id = '00000000-0000-0000-0000-0000000000d0'), 'shared auth: another app''s sign-up gets no Inoa profile');
select t.ok((select display_name from public.ig_profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Ana script', 'display name from sign-up metadata is stripped of < >');
select public.ig_grant_owner_by_email('owner@example.test');
select t.ok(public.ig_is_admin('00000000-0000-0000-0000-0000000000ff'), 'owner bootstrap grants admin');
select t.fails($$ select public.ig_grant_owner_by_email('c@example.test') $$, 'owner bootstrap refuses an unverified email');

-- ================= anon =================
set role anon; select set_config('request.jwt.claims', '{}', false);
select t.ok((select count(*) from public.ig_game_catalog) = 13, 'anon reads the game catalog');
select t.fails($$ select * from public.ig_profiles $$, 'anon cannot read profiles');
select t.fails($$ select public.ig_start_game('drift', 'anon-key-123') $$, 'anon cannot call start_game');
select t.fails($$ select public.ig_grant_owner_by_email('a@example.test') $$, 'anon cannot run the owner bootstrap');
reset role;

-- ================= player A: isolation + column grants =================
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from public.ig_profiles) = 1, 'A sees exactly one profile (own)');
select t.ok((select count(*) from public.ig_profiles where id = '00000000-0000-0000-0000-00000000000b') = 0, 'A cannot read B''s profile');
update public.ig_profiles set display_name = 'Ana' where id = '00000000-0000-0000-0000-00000000000a';
select t.ok((select display_name from public.ig_profiles) = 'Ana', 'A can rename themself');
update public.ig_profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b';
reset role; select t.ok((select display_name from public.ig_profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Ben', 'A''s update of B''s profile changed nothing (RLS)'); set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ update public.ig_profiles set xp = 999999 where id = auth.uid() $$, 'A cannot write own XP directly');
select t.fails($$ update public.ig_profiles set coins = 999999 where id = auth.uid() $$, 'A cannot write own coins directly');
select t.fails($$ update public.ig_profiles set display_name = '<img onerror=x>' where id = auth.uid() $$, 'display name with markup is rejected by the check constraint');
select t.fails($$ insert into public.ig_subscriptions (user_id, status, current_period_end) values (auth.uid(), 'active', now() + interval '1 year') $$, 'A cannot grant themself premium');
select t.fails($$ insert into public.ig_user_roles values (auth.uid(), 'admin') $$, 'A cannot grant themself admin');
select t.fails($$ select * from public.ig_user_roles $$, 'A cannot read roles');
select t.fails($$ update public.ig_account_status set suspended = false where user_id = auth.uid() $$, 'A cannot change own suspension');
select t.fails($$ insert into public.ig_daily_usage (user_id, usage_date, starts) values (auth.uid(), current_date, -5) $$, 'A cannot write usage counters');
select t.fails($$ update public.ig_daily_usage set starts = 0 $$, 'A cannot reset usage counters');
select t.fails($$ select * from public.ig_events $$, 'A cannot read analytics events');
select t.fails($$ select * from public.ig_payment_webhook_events $$, 'A cannot read webhook events');
select t.fails($$ select * from public.ig_admin_audit_logs $$, 'A cannot read audit logs');
select t.fails($$ select public.ig_admin_kpis(30) $$, 'A cannot call admin_kpis');
select t.fails($$ select public.ig_admin_list_users(null, 25, 0) $$, 'A cannot list users');
select t.fails($$ select public.ig_admin_set_suspended('00000000-0000-0000-0000-00000000000b', true, 'x') $$, 'A cannot suspend B');
select t.fails($$ select public.ig_admin_grant_premium(auth.uid(), now() + interval '30 days', 'x') $$, 'A cannot grant premium via admin RPC');
select t.fails($$ select public.ig_apply_billing_event('evt_x', 'customer.subscription.created', now(), '{}') $$, 'A cannot apply billing events');
select t.fails($$ select public.ig_grant_owner_by_email('a@example.test') $$, 'A cannot run the owner bootstrap');
select t.ok((public.ig_my_status() ->> 'plan') = 'free' and (public.ig_my_status() ->> 'starts_left')::int = 3, 'A starts free with 3 starts');

-- ================= free starts =================
select t.ok((public.ig_start_game('drift', 'tabkey-0001') ->> 'allowed')::boolean, 'start 1 allowed');
select t.ok((public.ig_start_game('drift', 'tabkey-0001') ->> 'reused')::boolean, 'same tab key reuses the session (reload/retry is free)');
select t.ok((public.ig_my_status() ->> 'starts_left')::int = 2, 'reuse did not consume a start');
select t.ok((public.ig_start_game('fit', 'tabkey-0002') ->> 'allowed')::boolean, 'start 2 allowed');
select t.ok((public.ig_start_game('junk', 'tabkey-0003') ->> 'allowed')::boolean, 'start 3 allowed');
select t.ok((public.ig_start_game('brew', 'tabkey-0004') ->> 'reason') = 'limit', 'start 4 denied: daily limit');
select t.ok((public.ig_my_status() ->> 'starts_left')::int = 0, 'starts_left is 0');
select t.ok((public.ig_start_game('nope', 'tabkey-0005') ->> 'reason') = 'unknown_game', 'unknown game rejected');
select t.ok((public.ig_start_game('drift', 'x') ->> 'reason') = 'bad_request', 'malformed client key rejected');

-- ================= rewards =================
select (public.ig_start_game('drift', 'tabkey-0001') ->> 'session_id') as sid \gset
select t.ok((public.ig_finish_round(:'sid', 'r1', 30.5, true, 120, 40) ->> 'reason') = 'too_fast', 'round finished 0 s after start is rejected (too fast)');
select t.age_session(:'sid', 60);
select t.ok((public.ig_finish_round(:'sid', 'r1', 30.5, true, 99999, 99999) ->> 'xp')::int = 400, 'XP clamped to the per-round cap');
select t.ok((public.ig_finish_round(:'sid', 'r1', 30.5, true, 120, 40) ->> 'duplicate')::boolean, 'same round key again = duplicate, no second reward');
select t.ok((select xp from public.ig_profiles) = 400 and (select coins from public.ig_profiles) = 150, 'profile totals reflect one clamped reward');
select t.age_session(:'sid', 60);
select t.ok((public.ig_finish_round(:'sid', 'r2', 28.0, true, 50, 10) ->> 'new_best')::boolean, 'faster lap is a new best (best_lower)');
select t.age_session(:'sid', 60);
select t.ok(not (public.ig_finish_round(:'sid', 'r3', 35.0, true, 50, 10) ->> 'new_best')::boolean, 'slower lap is not a best');
select t.ok((select best_score from public.ig_game_progress where game_id = 'drift') = 28.0, 'best score stored = 28.0');
select t.ok((select count(*) from public.ig_user_achievements) >= 2, 'achievements awarded (first_round, first_best)');
select t.ok((select count(*) from jsonb_array_elements(public.ig_my_achievements()) e where e ->> 'earned_at' is not null) >= 2, 'my_achievements lists earned ones');
select t.fails($$ insert into public.ig_user_achievements values (auth.uid(), 3, now(), 'x') $$, 'A cannot self-award achievements');
-- daily caps
do $$ declare i int; s uuid := (select id from public.ig_game_sessions where client_key = 'tabkey-0001'); begin for i in 4..30 loop perform t.age_session(s, 60); perform public.ig_finish_round(s, 'r' || i, null, false, 400, 150); end loop; end $$;
select t.ok((select xp_earned from public.ig_daily_usage) <= 4000 and (select coins_earned from public.ig_daily_usage) <= 1500, 'daily XP/coin caps hold');
-- local import (once, capped)
select t.ok((public.ig_import_local_profile(999999, 999999, '{"runner": {"plays": 9999, "best": 1269}, "fake": {"plays": 3}}') ->> 'xp')::int = 5000, 'local import capped at 5000 XP');
select t.ok((public.ig_import_local_profile(10, 10, '{}') ->> 'reason') = 'already_imported', 'local import only once');
select t.ok((select play_count from public.ig_game_progress where game_id = 'runner') = 500, 'imported plays capped at 500');
select t.ok(not exists (select 1 from public.ig_game_progress where game_id = 'fake'), 'unknown game ids ignored on import');
reset role;

-- ================= player B cannot touch A's session =================
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from public.ig_game_sessions) = 0, 'B sees none of A''s sessions');
select t.ok((public.ig_finish_round(:'sid', 'b1', 1, false, 400, 150) ->> 'reason') = 'no_session', 'B cannot claim rewards on A''s session');
select t.ok((select count(*) from public.ig_game_progress) = 0 and (select count(*) from public.ig_daily_usage) = 0, 'B sees no A progress/usage');
reset role;

-- ================= unverified C =================
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok((public.ig_start_game('drift', 'ckey-00001') ->> 'reason') = 'unverified', 'unverified email cannot start games');
reset role;

-- ================= billing events (service role) =================
set role service_role;
select t.ok((public.ig_apply_billing_event('evt_1', 'customer.subscription.created', now() - interval '5 minutes',
  '{"id":"sub_1","customer":"cus_1","status":"active","cancel_at_period_end":false,"current_period_start":1700000000,"current_period_end":4102444800,"metadata":{"user_id":"00000000-0000-0000-0000-00000000000b"}}') ->> 'status') = 'processed', 'subscription.created processed');
select t.ok((public.ig_apply_billing_event('evt_1', 'customer.subscription.created', now(), '{}') ->> 'status') = 'duplicate', 'duplicate webhook event ignored (idempotent)');
select t.ok((public.ig_apply_billing_event('evt_0', 'customer.subscription.updated', now() - interval '1 hour',
  '{"id":"sub_1","customer":"cus_1","status":"canceled","current_period_end":1700000001}') ->> 'status') = 'stale', 'older out-of-order event does not overwrite newer state');
select t.ok((select status from public.ig_subscriptions where provider_subscription_id = 'sub_1') = 'active', 'subscription still active after stale event');
select t.ok((public.ig_apply_billing_event('evt_2', 'invoice.paid', now(), '{"customer":"cus_1","amount_paid":499}') ->> 'status') = 'processed', 'invoice.paid recorded (user found via customer id)');
reset role;
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((public.ig_my_status() ->> 'plan') = 'premium', 'B is premium after the verified webhook');
select t.ok((select count(*) from public.ig_subscriptions) = 1, 'B reads own subscription');
do $$ declare i int; begin for i in 1..6 loop perform t.ok((public.ig_start_game('drift', 'bkey-' || lpad(i::text, 5, '0')) ->> 'allowed')::boolean, 'premium start ' || i || ' has no daily limit'); end loop; end $$;
reset role;
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from public.ig_subscriptions) = 0, 'A cannot see B''s subscription');
reset role;
set role service_role;
select t.ok((public.ig_apply_billing_event('evt_3', 'customer.subscription.updated', now() + interval '1 minute',
  '{"id":"sub_1","customer":"cus_1","status":"active","cancel_at_period_end":true,"current_period_end":4102444800}') ->> 'status') = 'processed', 'cancel at period end processed');
select t.ok((public.ig_apply_billing_event('evt_4', 'customer.subscription.deleted', now() + interval '2 minutes',
  '{"id":"sub_1","customer":"cus_1","status":"canceled","current_period_end":1700000002}') ->> 'status') = 'processed', 'subscription.deleted processed');
reset role;
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((public.ig_my_status() ->> 'plan') = 'free', 'B is back to free after cancellation ends');
reset role;

-- ================= owner =================
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000ff');
select t.ok((public.ig_my_status() ->> 'is_admin')::boolean, 'owner status says admin');
select t.ok((public.ig_admin_kpis(30) ->> 'users_total')::int = 4, 'admin_kpis counts Inoa users only (not other apps sharing auth)');
select t.ok((public.ig_admin_kpis(30) ->> 'gross_receipts_cents')::int = 499, 'admin_kpis gross receipts from invoice.paid');
select t.ok(jsonb_array_length(public.ig_admin_list_users('ben', 25, 0) -> 'users') = 1, 'admin search finds Ben');
select t.ok((public.ig_admin_list_users(null, 2, 0) ->> 'total')::int = 4 and jsonb_array_length(public.ig_admin_list_users(null, 2, 0) -> 'users') = 2, 'admin list is paginated');
select t.ok((public.ig_admin_user_detail('00000000-0000-0000-0000-00000000000a') -> 'profile' ->> 'display_name') = 'Ana', 'admin can open a user');
select public.ig_admin_set_suspended('00000000-0000-0000-0000-00000000000a', true, 'test');
select t.fails($$ select public.ig_admin_set_suspended(auth.uid(), true, 'oops') $$, 'owner cannot suspend themself');
select public.ig_admin_grant_premium('00000000-0000-0000-0000-00000000000c', now() + interval '30 days', 'support');
select t.ok(jsonb_array_length(public.ig_admin_recent_audit(10)) >= 3, 'admin actions are audited');
reset role;
set role authenticated; select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((public.ig_start_game('drift', 'tabkey-0001') ->> 'reason') = 'suspended', 'suspended player cannot start');
select t.ok((select suspended from public.ig_account_status) and (select xp from public.ig_profiles) > 0, 'suspension keeps the player''s data');
reset role;
select t.ok((select count(*) from public.ig_events where name = 'game_started') >= 9, 'game_started events recorded');
-- day rollover: yesterday's exhausted allowance does not count today (dates come from the DB clock, UTC)
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000ee', 'e@example.test', now());
insert into public.ig_daily_usage (user_id, usage_date, starts) values ('00000000-0000-0000-0000-0000000000ee', public.ig_utc_today() - 1, 3);
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000ee');
select t.ok((public.ig_my_status() ->> 'starts_left')::int = 3, 'new UTC day: full allowance again');
select t.ok((public.ig_my_status() ->> 'display_name') = 'Hero', 'account made outside the Inoa form gets a profile lazily on first use');
select (public.ig_start_game('tray', 'ekey-00001') ->> 'session_id') as esid \gset
reset role;
update public.ig_game_sessions set expires_at = now() - interval '1 minute' where id = :'esid';
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000ee');
select t.ok(not (public.ig_start_game('tray', 'ekey-00001') ->> 'reused')::boolean, 'expired session: same tab key is not reused');
select t.ok((public.ig_my_status() ->> 'starts_left')::int = 1, 'expired session: the new window took a new start');
select t.ok((public.ig_finish_round(:'esid', 'late', 1, false, 10, 1) ->> 'reason') is distinct from 'session_expired', 'rotated session accepts rounds again');
reset role;
update public.ig_game_catalog set access_tier = 'premium' where game_id = 'trivia';
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000ee');
select t.ok((public.ig_start_game('trivia', 'ekey-00002') ->> 'reason') = 'premium_only', 'premium-tier game refused for free players (no start consumed)');
select t.ok((public.ig_my_status() ->> 'starts_left')::int = 1, 'refused premium start consumed nothing');
reset role;
update public.ig_game_catalog set access_tier = 'free' where game_id = 'trivia';
\echo SQL_TESTS_DONE
