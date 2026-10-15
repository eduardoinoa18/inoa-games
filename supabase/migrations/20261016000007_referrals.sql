-- Referrals (owner decision 2026-10-15): "invite people who create an account → $1 credit each toward the monthly
-- subscription, up to 5 a month". A referral is attributed at sign-up (metadata ref = the inviter's code) and credited only
-- when the new account VERIFIES its email. Credits accumulate in a ledger now; they are applied to Premium when paid plans
-- launch (Stripe customer balance or an equivalent store mechanism). One referral per new account; no self-referral.

insert into public.ig_app_config (key, value) values ('referral_credit_cents', '100'), ('referral_monthly_cap', '5') on conflict (key) do nothing;

alter table public.ig_profiles add column if not exists ref_code text unique check (ref_code ~ '^[A-Z2-9]{6}$');

create table public.ig_referrals (
  id bigserial primary key,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'credited', 'capped')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  check (referrer_id <> referred_id)
);
create index ig_referrals_referrer_idx on public.ig_referrals (referrer_id, verified_at desc);

create table public.ig_credit_ledger (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,   -- kept (unlinked) for accounting after account deletion
  amount_cents integer not null,
  reason text not null check (reason in ('referral', 'admin_adjustment', 'applied_to_subscription')),
  referral_id bigint references public.ig_referrals (id) on delete set null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index ig_credit_ledger_user_idx on public.ig_credit_ledger (user_id, created_at desc);

alter table public.ig_referrals enable row level security;
alter table public.ig_credit_ledger enable row level security;
revoke all on table public.ig_referrals, public.ig_credit_ledger from anon, authenticated;
revoke all on sequence public.ig_referrals_id_seq, public.ig_credit_ledger_id_seq from anon, authenticated;

-- 6-character code without look-alike characters (no I, O, 0, 1)
create function public.ig_new_ref_code() returns text language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := ''; for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.ig_profiles where ref_code = c);
  end loop;
  return c;
end $$;

-- Attribution: called from the sign-up trigger with the code from the sign-up metadata.
create function public.ig_attribute_referral(p_new uuid, p_code text) returns void language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if p_code is null or p_code !~* '^[A-Z2-9]{6}$' then return; end if;
  select id into who from public.ig_profiles where ref_code = upper(p_code);
  if who is null or who = p_new then return; end if;
  insert into public.ig_referrals (referrer_id, referred_id) values (who, p_new) on conflict (referred_id) do nothing;
  perform public.ig_log_event(who, 'referral_signup', null, '{}'::jsonb);
end $$;

-- Credit on email verification (up to the monthly cap, counted per UTC month of verification).
create function public.ig_credit_referral(p_new uuid) returns void language plpgsql security definer set search_path = public as $$
declare r public.ig_referrals; n int;
begin
  select * into r from public.ig_referrals where referred_id = p_new and status = 'pending' for update;
  if not found then return; end if;
  select count(*) into n from public.ig_referrals where referrer_id = r.referrer_id and status = 'credited'
    and verified_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if n >= public.ig_cfg_int('referral_monthly_cap') then
    update public.ig_referrals set status = 'capped', verified_at = now() where id = r.id;
  else
    update public.ig_referrals set status = 'credited', verified_at = now() where id = r.id;
    insert into public.ig_credit_ledger (user_id, amount_cents, reason, referral_id) values (r.referrer_id, public.ig_cfg_int('referral_credit_cents'), 'referral', r.id);
    perform public.ig_log_event(r.referrer_id, 'referral_credited', null, jsonb_build_object('cents', public.ig_cfg_int('referral_credit_cents')));
  end if;
end $$;

-- Sign-up trigger: same as before + referral attribution (Inoa sign-ups only).
create or replace function public.ig_handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '[<>]', '', 'g'), 24);
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') <> 'inoa' then return new; end if;
  insert into public.ig_profiles (id, display_name) values (new.id, coalesce(nullif(btrim(nm), ''), 'Hero')) on conflict (id) do nothing;
  insert into public.ig_account_status (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.ig_log_event(new.id, 'account_registered');
  perform public.ig_attribute_referral(new.id, new.raw_user_meta_data ->> 'ref');
  if new.email_confirmed_at is not null then perform public.ig_credit_referral(new.id); end if;
  return new;
end $$;

create or replace function public.ig_handle_user_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and exists (select 1 from public.ig_profiles where id = new.id) then
    perform public.ig_log_event(new.id, 'account_verified');
    perform public.ig_credit_referral(new.id);
  end if;
  return new;
end $$;

-- Player view: my code (created on first use), this month's progress, balance, recent friends (display names only).
create function public.ig_my_referrals() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); code text; month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.ig_ensure_profile(uid);
  select ref_code into code from public.ig_profiles where id = uid;
  if code is null then
    for i in 1..5 loop
      begin update public.ig_profiles set ref_code = public.ig_new_ref_code() where id = uid returning ref_code into code; exit;
      exception when unique_violation then null; end;
    end loop;
  end if;
  return jsonb_build_object(
    'code', code,
    'credit_cents', public.ig_cfg_int('referral_credit_cents'),
    'monthly_cap', public.ig_cfg_int('referral_monthly_cap'),
    'credited_this_month', (select count(*) from public.ig_referrals where referrer_id = uid and status = 'credited' and verified_at >= month_start),
    'pending', (select count(*) from public.ig_referrals where referrer_id = uid and status = 'pending'),
    'total_credited', (select count(*) from public.ig_referrals where referrer_id = uid and status = 'credited'),
    'balance_cents', (select coalesce(sum(amount_cents), 0) from public.ig_credit_ledger where user_id = uid),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, 'Friend'), 'status', r.status, 'at', coalesce(r.verified_at, r.created_at)) order by r.created_at desc), '[]'::jsonb)
               from (select * from public.ig_referrals where referrer_id = uid order by created_at desc limit 10) r left join public.ig_profiles p on p.id = r.referred_id));
end $$;

-- Owner view (admin dashboard)
create function public.ig_admin_referrals(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 3650));
begin
  perform public.ig_require_admin();
  return jsonb_build_object(
    'signups', (select count(*) from public.ig_referrals where created_at >= since),
    'credited', (select count(*) from public.ig_referrals where status = 'credited' and verified_at >= since),
    'capped', (select count(*) from public.ig_referrals where status = 'capped' and verified_at >= since),
    'pending', (select count(*) from public.ig_referrals where status = 'pending'),
    'credit_outstanding_cents', (select coalesce(sum(amount_cents), 0) from public.ig_credit_ledger),
    'top', (select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
      select p.display_name as name, u.email, count(*) as n from public.ig_referrals r join auth.users u on u.id = r.referrer_id left join public.ig_profiles p on p.id = r.referrer_id
      where r.status = 'credited' and r.verified_at >= since group by p.display_name, u.email order by count(*) desc limit 10) t));
end $$;

revoke execute on function public.ig_new_ref_code(), public.ig_attribute_referral(uuid, text), public.ig_credit_referral(uuid),
  public.ig_my_referrals(), public.ig_admin_referrals(integer) from public, anon, authenticated;
grant execute on function public.ig_my_referrals(), public.ig_admin_referrals(integer) to authenticated;
