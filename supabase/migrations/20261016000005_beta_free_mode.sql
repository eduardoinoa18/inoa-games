-- Free beta mode (owner decision 2026-10-15): while testing with real people, everything is free and unlimited.
-- ig_app_config.access_mode = 'beta_free'  → every signed-in player gets plan 'beta' (all games, no daily counter, no billing).
--                           = 'commercial' → the free tier (3 starts / UTC day) + Premium subscription rules apply again.
-- Switching to commercial is one row: update public.ig_app_config set value = '"commercial"' where key = 'access_mode';
-- Billing code paths stay in place and tested; the checkout API additionally refuses unless BILLING_ENABLED=yes (Vercel env).

insert into public.ig_app_config (key, value) values ('access_mode', '"beta_free"') on conflict (key) do nothing;

create function public.ig_cfg_text(k text) returns text language sql stable security definer set search_path = public as
$$ select value #>> '{}' from public.ig_app_config where key = k $$;
revoke execute on function public.ig_cfg_text(text) from public, anon, authenticated;

alter table public.ig_game_sessions drop constraint if exists ig_game_sessions_access_type_check;
alter table public.ig_game_sessions add constraint ig_game_sessions_access_type_check check (access_type in ('free', 'premium', 'admin', 'beta'));

-- Entitlement: admin > paid premium > beta (everyone, while the beta runs) > free.
create or replace function public.ig_entitlement(uid uuid) returns text language sql stable security definer set search_path = public as $$
  select case
    when public.ig_is_admin(uid) then 'admin'
    when exists (select 1 from public.ig_subscriptions s where s.user_id = uid
                 and s.status in ('active', 'trialing', 'past_due') and s.current_period_end > now()) then 'premium'
    when coalesce(public.ig_cfg_text('access_mode'), 'commercial') = 'beta_free' then 'beta'
    else 'free' end
$$;

-- my_status also reports the mode so the UI can say "free during the beta" (the server stays the authority).
create or replace function public.ig_my_status() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); plan text; used int; lim int := public.ig_cfg_int('free_daily_starts'); p public.ig_profiles; s public.ig_subscriptions; verified boolean; susp boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.ig_ensure_profile(uid);
  select * into p from public.ig_profiles where id = uid;
  select (email_confirmed_at is not null) into verified from auth.users where id = uid;
  select coalesce(suspended, false) into susp from public.ig_account_status where user_id = uid;
  plan := public.ig_entitlement(uid);
  select coalesce(starts, 0) into used from public.ig_daily_usage where user_id = uid and usage_date = public.ig_utc_today();
  select * into s from public.ig_subscriptions where user_id = uid order by current_period_end desc nulls last limit 1;
  return jsonb_build_object(
    'user_id', uid, 'display_name', p.display_name, 'hero', p.hero, 'lang', p.lang, 'xp', p.xp, 'coins', p.coins,
    'level', public.ig_hero_level(p.xp), 'imported_local', p.imported_local, 'verified', coalesce(verified, false),
    'suspended', coalesce(susp, false), 'plan', plan, 'is_admin', plan = 'admin',
    'access_mode', coalesce(public.ig_cfg_text('access_mode'), 'commercial'),
    'starts_used', coalesce(used, 0), 'starts_limit', lim, 'starts_left', case when plan = 'free' then greatest(0, lim - coalesce(used, 0)) else null end,
    'resets_at', (public.ig_utc_today() + 1)::timestamp at time zone 'utc',
    'subscription', case when s.id is null then null else jsonb_build_object('status', s.status, 'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end, 'provider', s.provider) end,
    'server_time', now());
end $$;
revoke execute on function public.ig_my_status() from public, anon;
grant execute on function public.ig_my_status() to authenticated;
