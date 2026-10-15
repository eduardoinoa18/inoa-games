-- Inoa Games platform: trusted functions (RPC). All SECURITY DEFINER functions pin search_path, take the caller from
-- auth.uid() (never from a parameter) and are granted explicitly; PUBLIC execute is revoked at the end.

-- ---------- helpers ----------
create function public.cfg_int(k text) returns integer language sql stable security definer set search_path = public as
$$ select (value #>> '{}')::integer from public.app_config where key = k $$;

create function public.utc_today() returns date language sql stable as $$ select (now() at time zone 'utc')::date $$;

create function public.is_admin(uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.user_roles where user_id = uid and role = 'admin') $$;

create function public.log_event(uid uuid, ev text, game text default null, p jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as
$$ insert into public.events (user_id, name, game_id, props) values (uid, ev, game, coalesce(p, '{}'::jsonb)) $$;

-- Premium entitlement (docs/PLATFORM_ARCHITECTURE.md §6). Returns 'admin' | 'premium' | 'free'.
create function public.entitlement(uid uuid) returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin(uid) then 'admin'
    when exists (select 1 from public.subscriptions s where s.user_id = uid
                 and s.status in ('active', 'trialing', 'past_due') and s.current_period_end > now()) then 'premium'
    else 'free' end
$$;

create function public.hero_level(xp integer) returns integer language plpgsql immutable as $$
declare lv int := 1; need int := 100; x int := xp;
begin
  while x >= need and lv < 50 loop x := x - need; lv := lv + 1; need := round(need * 1.12); end loop;
  return lv;
end $$;

-- ---------- new users get a profile (display name from sign-up metadata, sanitised) ----------
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '[<>]', '', 'g'), 24);
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(nullif(btrim(nm), ''), 'Hero')) on conflict (id) do nothing;
  insert into public.account_status (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.log_event(new.id, 'account_registered');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.handle_user_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then perform public.log_event(new.id, 'account_verified'); end if;
  return new;
end $$;
create trigger on_auth_user_verified after update of email_confirmed_at on auth.users for each row execute function public.handle_user_verified();

-- ---------- player status (one call for the hub/HUD) ----------
create function public.my_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); plan text; used int; lim int := public.cfg_int('free_daily_starts'); p public.profiles; s public.subscriptions; verified boolean; susp boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.profiles where id = uid;
  select (email_confirmed_at is not null) into verified from auth.users where id = uid;
  select coalesce(suspended, false) into susp from public.account_status where user_id = uid;
  plan := public.entitlement(uid);
  select coalesce(starts, 0) into used from public.daily_usage where user_id = uid and usage_date = public.utc_today();
  select * into s from public.subscriptions where user_id = uid order by current_period_end desc nulls last limit 1;
  return jsonb_build_object(
    'user_id', uid, 'display_name', p.display_name, 'hero', p.hero, 'lang', p.lang, 'xp', p.xp, 'coins', p.coins,
    'level', public.hero_level(p.xp), 'imported_local', p.imported_local, 'verified', coalesce(verified, false),
    'suspended', coalesce(susp, false), 'plan', plan, 'is_admin', plan = 'admin',
    'starts_used', coalesce(used, 0), 'starts_limit', lim, 'starts_left', case when plan = 'free' then greatest(0, lim - coalesce(used, 0)) else null end,
    'resets_at', (public.utc_today() + 1)::timestamp at time zone 'utc',
    'subscription', case when s.id is null then null else jsonb_build_object('status', s.status, 'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end, 'provider', s.provider) end,
    'server_time', now());
end $$;

-- ---------- the free-tier gate: one qualifying start = one play session (docs §5) ----------
create function public.start_game(p_game text, p_client_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); plan text; verified boolean; susp boolean; g public.game_catalog; sess public.game_sessions;
        lim int := public.cfg_int('free_daily_starts'); used int; mins int := public.cfg_int('session_minutes');
begin
  if uid is null then return jsonb_build_object('allowed', false, 'reason', 'not_authenticated'); end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 64 then return jsonb_build_object('allowed', false, 'reason', 'bad_request'); end if;
  select * into g from public.game_catalog where game_id = p_game and is_active;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'unknown_game'); end if;
  select coalesce(suspended, false) into susp from public.account_status where user_id = uid;
  if susp then perform public.log_event(uid, 'start_denied', p_game, '{"reason":"suspended"}'); return jsonb_build_object('allowed', false, 'reason', 'suspended'); end if;
  select (email_confirmed_at is not null) into verified from auth.users where id = uid;
  if not coalesce(verified, false) then return jsonb_build_object('allowed', false, 'reason', 'unverified'); end if;

  -- reload / retry / double click: same client key, unexpired session → reuse, no charge
  select * into sess from public.game_sessions where user_id = uid and client_key = p_client_key and game_id = p_game and expires_at > now() and ended_at is null;
  if found then return jsonb_build_object('allowed', true, 'session_id', sess.id, 'expires_at', sess.expires_at, 'access', sess.access_type, 'reused', true); end if;

  plan := public.entitlement(uid);
  if plan = 'free' and g.access_tier = 'premium' then
    perform public.log_event(uid, 'start_denied', p_game, '{"reason":"premium_only"}'); return jsonb_build_object('allowed', false, 'reason', 'premium_only');
  end if;
  if plan = 'free' then
    -- atomic check-and-consume: the conditional upsert takes a row lock, so parallel calls cannot share the last slot
    insert into public.daily_usage as du (user_id, usage_date, starts) values (uid, public.utc_today(), 1)
      on conflict (user_id, usage_date) do update set starts = du.starts + 1, updated_at = now() where du.starts < lim
      returning du.starts into used;
    if used is null then
      perform public.log_event(uid, 'start_denied', p_game, '{"reason":"limit"}');
      return jsonb_build_object('allowed', false, 'reason', 'limit', 'starts_left', 0, 'resets_at', (public.utc_today() + 1)::timestamp at time zone 'utc');
    end if;
  end if;
  begin
    insert into public.game_sessions (user_id, game_id, client_key, access_type, expires_at)
      values (uid, p_game, p_client_key, plan, now() + make_interval(mins => mins)) returning * into sess;
  exception when unique_violation then
    -- an expired session with the same key: rotate it into a new window (key reuse after expiry is a new start)
    update public.game_sessions set started_at = now(), expires_at = now() + make_interval(mins => mins), ended_at = null, access_type = plan
      where user_id = uid and client_key = p_client_key and game_id = p_game returning * into sess;
  end;
  insert into public.game_progress (user_id, game_id, play_count, last_played_at) values (uid, p_game, 1, now())
    on conflict (user_id, game_id) do update set play_count = public.game_progress.play_count + 1, last_played_at = now();
  perform public.log_event(uid, 'game_started', p_game, jsonb_build_object('access', plan));
  return jsonb_build_object('allowed', true, 'session_id', sess.id, 'expires_at', sess.expires_at, 'access', plan, 'reused', false,
    'starts_left', case when plan = 'free' then lim - used else null end);
end $$;

-- ---------- achievements ----------
create function public.award(uid uuid, ach text, src text default null) returns boolean language plpgsql security definer set search_path = public as $$
declare aid int; n int;
begin
  select id into aid from public.achievements where code = ach and is_active; if aid is null then return false; end if;
  insert into public.user_achievements (user_id, achievement_id, source) values (uid, aid, src) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.log_event(uid, 'achievement_earned', null, jsonb_build_object('code', ach)); end if;
  return n > 0;
end $$;

create function public.check_achievements(uid uuid, newbest boolean) returns text[] language plpgsql security definer set search_path = public as $$
declare got text[] := '{}'; rounds int; games int; days int; total int; lv int;
begin
  select count(*) into rounds from public.session_rounds where user_id = uid;
  select count(distinct game_id) into games from public.session_rounds where user_id = uid;
  select count(distinct (created_at at time zone 'utc')::date) into days from public.session_rounds where user_id = uid;
  select count(*) into total from public.game_catalog where is_active;
  select public.hero_level(xp) into lv from public.profiles where id = uid;
  if rounds >= 1 and public.award(uid, 'first_round') then got := array_append(got, 'first_round'); end if;
  if rounds >= 5 and public.award(uid, 'five_rounds') then got := array_append(got, 'five_rounds'); end if;
  if rounds >= 50 and public.award(uid, 'fifty_rounds') then got := array_append(got, 'fifty_rounds'); end if;
  if games >= 3 and public.award(uid, 'three_games') then got := array_append(got, 'three_games'); end if;
  if games >= total and public.award(uid, 'all_games') then got := array_append(got, 'all_games'); end if;
  if newbest and public.award(uid, 'first_best') then got := array_append(got, 'first_best'); end if;
  if days >= 3 and public.award(uid, 'three_days') then got := array_append(got, 'three_days'); end if;
  if lv >= 5 and public.award(uid, 'level_5') then got := array_append(got, 'level_5'); end if;
  if lv >= 10 and public.award(uid, 'level_10') then got := array_append(got, 'level_10'); end if;
  return got;
end $$;

-- ---------- round results: server-clamped, idempotent rewards (docs §7) ----------
create function public.finish_round(p_session uuid, p_round_key text, p_score numeric default null, p_best_lower boolean default false,
                                    p_xp integer default 0, p_coins integer default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.game_sessions; v_xp int; v_coins int; du public.daily_usage; n int; prog public.game_progress; newbest boolean := false; ach text[]; p public.profiles; last_at timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select * into s from public.game_sessions where id = p_session and user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;
  if now() > s.expires_at + interval '10 minutes' then return jsonb_build_object('ok', false, 'reason', 'session_expired'); end if;
  if p_round_key is null or char_length(p_round_key) not between 1 and 64 then return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  if exists (select 1 from public.session_rounds where session_id = s.id and round_key = p_round_key) then
    select * into p from public.profiles where id = uid;
    return jsonb_build_object('ok', true, 'duplicate', true, 'xp_total', p.xp, 'coins_total', p.coins, 'level', public.hero_level(p.xp));
  end if;
  select coalesce(max(created_at), s.started_at) into last_at from public.session_rounds where session_id = s.id;
  if now() - last_at < make_interval(secs => public.cfg_int('min_round_seconds')) then return jsonb_build_object('ok', false, 'reason', 'too_fast'); end if;

  v_xp := least(greatest(coalesce(p_xp, 0), 0), public.cfg_int('round_xp_cap'));
  v_coins := least(greatest(coalesce(p_coins, 0), 0), public.cfg_int('round_coin_cap'));
  insert into public.daily_usage as d (user_id, usage_date) values (uid, public.utc_today()) on conflict (user_id, usage_date) do nothing;
  select * into du from public.daily_usage where user_id = uid and usage_date = public.utc_today() for update;
  v_xp := least(v_xp, greatest(0, public.cfg_int('daily_xp_cap') - du.xp_earned));
  v_coins := least(v_coins, greatest(0, public.cfg_int('daily_coin_cap') - du.coins_earned));

  insert into public.session_rounds (session_id, round_key, user_id, game_id, score, xp, coins) values (s.id, p_round_key, uid, s.game_id, p_score, v_xp, v_coins)
    on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then select * into p from public.profiles where id = uid; return jsonb_build_object('ok', true, 'duplicate', true, 'xp_total', p.xp, 'coins_total', p.coins); end if;

  update public.daily_usage set xp_earned = xp_earned + v_xp, coins_earned = coins_earned + v_coins, updated_at = now() where user_id = uid and usage_date = du.usage_date;
  update public.profiles set xp = xp + v_xp, coins = coins + v_coins where id = uid returning * into p;
  select * into prog from public.game_progress where user_id = uid and game_id = s.game_id;
  if p_score is not null and (prog.best_score is null or (p_best_lower and p_score < prog.best_score) or (not p_best_lower and p_score > prog.best_score)) then newbest := true; end if;
  update public.game_progress set completed_rounds = completed_rounds + 1, last_played_at = now(), best_lower = coalesce(p_best_lower, false),
    best_score = case when newbest then p_score else best_score end where user_id = uid and game_id = s.game_id;
  perform public.log_event(uid, 'game_completed', s.game_id, jsonb_build_object('xp', v_xp, 'coins', v_coins, 'best', newbest));
  ach := public.check_achievements(uid, newbest);
  return jsonb_build_object('ok', true, 'xp', v_xp, 'coins', v_coins, 'xp_total', p.xp, 'coins_total', p.coins, 'level', public.hero_level(p.xp),
    'new_best', newbest, 'best', case when newbest then p_score else prog.best_score end, 'achievements', to_jsonb(ach));
end $$;

-- ---------- one-time, capped import of on-device progress (docs §7) ----------
create function public.import_local_profile(p_xp integer, p_coins integer, p_games jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; k text; v jsonb; v_xp int; v_coins int; n int := 0;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select * into p from public.profiles where id = uid for update;
  if p.imported_local then return jsonb_build_object('ok', false, 'reason', 'already_imported'); end if;
  v_xp := least(greatest(coalesce(p_xp, 0), 0), public.cfg_int('import_xp_cap'));
  v_coins := least(greatest(coalesce(p_coins, 0), 0), public.cfg_int('import_coin_cap'));
  update public.profiles set xp = xp + v_xp, coins = coins + v_coins, imported_local = true where id = uid returning * into p;
  if jsonb_typeof(p_games) = 'object' then
    for k, v in select * from jsonb_each(p_games) loop
      exit when n >= 40; n := n + 1;
      if exists (select 1 from public.game_catalog where game_id = k) and jsonb_typeof(v) = 'object' then
        insert into public.game_progress (user_id, game_id, play_count, best_score, last_played_at)
          values (uid, k, least(greatest(coalesce((v ->> 'plays')::int, 0), 0), 500),
                  case when jsonb_typeof(v -> 'best') = 'number' then (v ->> 'best')::numeric end, now())
          on conflict (user_id, game_id) do nothing;
      end if;
    end loop;
  end if;
  perform public.log_event(uid, 'local_progress_imported', null, jsonb_build_object('xp', v_xp, 'coins', v_coins, 'games', n));
  return jsonb_build_object('ok', true, 'xp', v_xp, 'coins', v_coins, 'xp_total', p.xp, 'coins_total', p.coins);
end $$;

-- ---------- player-facing reads ----------
create function public.my_achievements() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'icon', a.icon, 'title_en', a.title_en, 'title_es', a.title_es, 'desc_en', a.desc_en, 'desc_es', a.desc_es,
    'earned_at', ua.earned_at) order by a.id), '[]'::jsonb)
  from public.achievements a left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = auth.uid() where a.is_active
$$;

-- ---------- Stripe webhook application (service role only; called by api/stripe-webhook.js after signature check) ----------
-- Idempotent by event id; ignores events older than the last one applied to the same subscription (out-of-order safety).
create function public.apply_billing_event(p_event_id text, p_type text, p_created timestamptz, p_obj jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; cust text; subid text; st text; ps timestamptz; pe timestamptz; cancel boolean; cur public.subscriptions; amt int;
begin
  insert into public.payment_webhook_events (provider_event_id, event_type, event_created) values (p_event_id, p_type, p_created) on conflict do nothing;
  if not found then return jsonb_build_object('status', 'duplicate'); end if;

  cust := coalesce(p_obj ->> 'customer', p_obj -> 'customer' ->> 'id');
  uid := nullif(coalesce(p_obj -> 'metadata' ->> 'user_id', p_obj ->> 'client_reference_id', p_obj -> 'subscription_details' -> 'metadata' ->> 'user_id'), '')::uuid;
  if uid is null and cust is not null then select user_id into uid from public.customers where provider_customer_id = cust; end if;
  if uid is not null and cust is not null then
    insert into public.customers (user_id, provider_customer_id) values (uid, cust) on conflict (user_id) do update set provider_customer_id = excluded.provider_customer_id;
  end if;

  if p_type like 'customer.subscription.%' then
    subid := p_obj ->> 'id'; st := p_obj ->> 'status'; cancel := coalesce((p_obj ->> 'cancel_at_period_end')::boolean, false);
    ps := to_timestamp(coalesce((p_obj ->> 'current_period_start')::bigint, (p_obj -> 'items' -> 'data' -> 0 ->> 'current_period_start')::bigint));
    pe := to_timestamp(coalesce((p_obj ->> 'current_period_end')::bigint, (p_obj -> 'items' -> 'data' -> 0 ->> 'current_period_end')::bigint));
    if p_type = 'customer.subscription.deleted' then st := 'canceled'; end if;
    select * into cur from public.subscriptions where provider_subscription_id = subid;
    if found and cur.last_event_at is not null and p_created < cur.last_event_at then
      update public.payment_webhook_events set status = 'ignored', processed_at = now(), user_id = uid, error = 'stale event' where provider_event_id = p_event_id;
      return jsonb_build_object('status', 'stale');
    end if;
    insert into public.subscriptions (user_id, provider, provider_customer_id, provider_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, last_event_at)
      values (uid, 'stripe', cust, subid, st, ps, pe, cancel, p_created)
      on conflict (provider_subscription_id) do update set user_id = coalesce(excluded.user_id, public.subscriptions.user_id), status = excluded.status,
        current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
        current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
        cancel_at_period_end = excluded.cancel_at_period_end, last_event_at = excluded.last_event_at;
    if st in ('active', 'trialing') and (cur.id is null or cur.status not in ('active', 'trialing')) then perform public.log_event(uid, 'premium_subscription_activated'); end if;
    if st = 'canceled' then perform public.log_event(uid, 'premium_subscription_canceled'); end if;
  elsif p_type = 'invoice.paid' then
    amt := (p_obj ->> 'amount_paid')::int;
    perform public.log_event(uid, 'payment_succeeded', null, jsonb_build_object('amount_cents', amt));
  elsif p_type = 'invoice.payment_failed' then
    amt := (p_obj ->> 'amount_due')::int;
    perform public.log_event(uid, 'payment_failed', null, jsonb_build_object('amount_cents', amt));
  elsif p_type = 'charge.refunded' then
    amt := (p_obj ->> 'amount_refunded')::int;
    perform public.log_event(uid, 'payment_refunded', null, jsonb_build_object('amount_cents', amt));
  elsif p_type = 'checkout.session.completed' then
    perform public.log_event(uid, 'checkout_completed');
  else
    update public.payment_webhook_events set status = 'ignored', processed_at = now() where provider_event_id = p_event_id;
    return jsonb_build_object('status', 'ignored');
  end if;
  update public.payment_webhook_events set status = 'processed', processed_at = now(), user_id = uid, amount_cents = amt where provider_event_id = p_event_id;
  return jsonb_build_object('status', 'processed', 'user_id', uid);
end $$;

-- Used by api/checkout.js (service role) to reuse a Stripe customer.
create function public.customer_for(uid uuid) returns text language sql stable security definer set search_path = public as
$$ select provider_customer_id from public.customers where user_id = uid $$;

-- ---------- admin (owner) ----------
create function public.require_admin() returns uuid language plpgsql stable security definer set search_path = public as $$
begin if not public.is_admin(auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if; return auth.uid(); end $$;

create function public.admin_kpis(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 3650); since timestamptz := now() - make_interval(days => d); price int := public.cfg_int('premium_price_cents'); premium int; r jsonb;
begin
  perform public.require_admin();
  select count(*) into premium from public.subscriptions s where s.status in ('active', 'trialing', 'past_due') and s.current_period_end > now() and s.provider = 'stripe';
  select jsonb_build_object(
    'range_days', d,
    'users_total', (select count(*) from auth.users),
    'users_verified', (select count(*) from auth.users where email_confirmed_at is not null),
    'signups_today', (select count(*) from auth.users where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'),
    'signups_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'signups_range', (select count(*) from auth.users where created_at >= since),
    'dau', (select count(distinct user_id) from public.events where name = 'game_started' and created_at >= now() - interval '1 day'),
    'wau', (select count(distinct user_id) from public.events where name = 'game_started' and created_at >= now() - interval '7 days'),
    'mau', (select count(distinct user_id) from public.events where name = 'game_started' and created_at >= now() - interval '30 days'),
    'premium_active', premium,
    'premium_canceling', (select count(*) from public.subscriptions where status in ('active', 'trialing') and cancel_at_period_end and current_period_end > now()),
    'premium_past_due', (select count(*) from public.subscriptions where status = 'past_due'),
    'subscriptions_ended_range', (select count(*) from public.events where name = 'premium_subscription_canceled' and created_at >= since),
    'mrr_estimate_cents', premium * price,
    'arr_estimate_cents', premium * price * 12,
    'gross_receipts_cents', (select coalesce(sum((props ->> 'amount_cents')::int), 0) from public.events where name = 'payment_succeeded' and created_at >= since),
    'refunds_cents', (select coalesce(sum((props ->> 'amount_cents')::int), 0) from public.events where name = 'payment_refunded' and created_at >= since),
    'failed_payments', (select count(*) from public.events where name = 'payment_failed' and created_at >= since),
    'activations_range', (select count(*) from public.events where name = 'premium_subscription_activated' and created_at >= since),
    'game_starts', (select count(*) from public.events where name = 'game_started' and created_at >= since),
    'rounds_completed', (select count(*) from public.events where name = 'game_completed' and created_at >= since),
    'limit_hits', (select count(*) from public.events where name = 'start_denied' and props ->> 'reason' = 'limit' and created_at >= since),
    'webhook_errors', (select count(*) from public.payment_webhook_events where status = 'error' and received_at >= since),
    'webhook_pending', (select count(*) from public.payment_webhook_events where status = 'received' and received_at < now() - interval '10 minutes'),
    'per_game', (select coalesce(jsonb_agg(x order by x ->> 'starts' desc), '[]'::jsonb) from (
        select jsonb_build_object('game_id', c.game_id, 'name', c.name,
          'starts', (select count(*) from public.game_sessions gs where gs.game_id = c.game_id and gs.started_at >= since),
          'rounds', (select count(*) from public.session_rounds sr where sr.game_id = c.game_id and sr.created_at >= since),
          'players', (select count(distinct gs.user_id) from public.game_sessions gs where gs.game_id = c.game_id and gs.started_at >= since),
          'repeat_players', (select count(*) from (select gs.user_id from public.game_sessions gs where gs.game_id = c.game_id and gs.started_at >= since group by gs.user_id having count(*) > 1) q)) as x
        from public.game_catalog c) t)
  ) into r;
  return r;
end $$;

create function public.admin_list_users(p_search text default null, p_limit integer default 25, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0); q text := nullif(btrim(coalesce(p_search, '')), ''); r jsonb; total int;
begin
  perform public.require_admin();
  select count(*) into total from auth.users u left join public.profiles p on p.id = u.id
    where q is null or u.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%';
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) into r from (
    select u.id, u.email, p.display_name, u.created_at, (u.email_confirmed_at is not null) as verified, public.entitlement(u.id) as plan,
      coalesce(st.suspended, false) as suspended, p.xp, public.hero_level(p.xp) as level,
      (select max(started_at) from public.game_sessions gs where gs.user_id = u.id) as last_played
    from auth.users u left join public.profiles p on p.id = u.id left join public.account_status st on st.user_id = u.id
    where q is null or u.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%'
    order by u.created_at desc limit lim offset off) t;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'users', r);
end $$;

create function public.admin_user_detail(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'user', (select row_to_json(t) from (select u.id, u.email, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null) as verified from auth.users u where u.id = p_user) t),
    'profile', (select row_to_json(p) from public.profiles p where p.id = p_user),
    'plan', public.entitlement(p_user),
    'status', (select row_to_json(s) from public.account_status s where s.user_id = p_user),
    'subscriptions', (select coalesce(jsonb_agg(row_to_json(s) order by s.created_at desc), '[]'::jsonb) from (select status, provider, current_period_end, cancel_at_period_end, created_at from public.subscriptions where user_id = p_user) s),
    'progress', (select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb) from public.game_progress g where g.user_id = p_user),
    'usage', (select coalesce(jsonb_agg(row_to_json(d) order by d.usage_date desc), '[]'::jsonb) from (select * from public.daily_usage where user_id = p_user order by usage_date desc limit 14) d),
    'achievements', (select count(*) from public.user_achievements where user_id = p_user),
    'audit', (select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb) from (select action, actor_user_id, metadata, created_at from public.admin_audit_logs where target_id = p_user::text order by created_at desc limit 20) a));
end $$;

create function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_user = actor and p_suspended then raise exception 'cannot suspend yourself'; end if;
  insert into public.account_status (user_id, suspended, reason, updated_at) values (p_user, p_suspended, left(p_reason, 300), now())
    on conflict (user_id) do update set suspended = excluded.suspended, reason = excluded.reason, updated_at = now();
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
    values (actor, case when p_suspended then 'suspend_user' else 'restore_user' end, 'user', p_user::text, jsonb_build_object('reason', left(p_reason, 300)));
  return jsonb_build_object('ok', true);
end $$;

-- Manual (complimentary) premium, e.g. for a support case. Audited; never touches Stripe.
create function public.admin_grant_premium(p_user uuid, p_until timestamptz, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin();
begin
  if p_until <= now() or p_until > now() + interval '400 days' then raise exception 'bad_until'; end if;
  insert into public.subscriptions (user_id, provider, status, current_period_start, current_period_end) values (p_user, 'manual', 'active', now(), p_until);
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata) values (actor, 'grant_premium', 'user', p_user::text, jsonb_build_object('until', p_until, 'note', left(p_note, 300)));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_revoke_manual_premium(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(); n int;
begin
  update public.subscriptions set status = 'canceled', current_period_end = now() where user_id = p_user and provider = 'manual' and status = 'active';
  get diagnostics n = row_count;
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata) values (actor, 'revoke_manual_premium', 'user', p_user::text, jsonb_build_object('rows', n));
  return jsonb_build_object('ok', true, 'revoked', n);
end $$;

create function public.admin_recent_audit(p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb) from (select * from public.admin_audit_logs order by created_at desc limit least(greatest(p_limit, 1), 200)) a);
end $$;

-- ---------- execute grants: nothing is callable unless listed here ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_status(), public.start_game(text, text), public.finish_round(uuid, text, numeric, boolean, integer, integer),
  public.import_local_profile(integer, integer, jsonb), public.my_achievements() to authenticated;
grant execute on function public.admin_kpis(integer), public.admin_list_users(text, integer, integer), public.admin_user_detail(uuid),
  public.admin_set_suspended(uuid, boolean, text), public.admin_grant_premium(uuid, timestamptz, text), public.admin_revoke_manual_premium(uuid),
  public.admin_recent_audit(integer) to authenticated;  -- each one checks is_admin() itself
grant execute on function public.apply_billing_event(text, text, timestamptz, jsonb), public.customer_for(uuid) to service_role;
-- helpers used inside RLS / other functions keep owner rights; is_admin/utc_today are harmless to expose to authenticated
grant execute on function public.utc_today(), public.hero_level(integer) to anon, authenticated;
