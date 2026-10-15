-- Inoa Games platform: core schema, RLS, grants. Runs on Supabase Postgres (auth schema provided by Supabase).
-- Design: docs/PLATFORM_ARCHITECTURE.md. Every user-owned table has RLS on; clients only ever read their own rows,
-- and all writes that matter (progress, usage, subscriptions, roles) go through SECURITY DEFINER functions.

create extension if not exists pgcrypto;

-- ---------- tunables ----------
create table public.ig_app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.ig_app_config (key, value) values
  ('free_daily_starts', '3'),
  ('session_minutes', '30'),
  ('min_round_seconds', '10'),
  ('round_xp_cap', '400'),
  ('round_coin_cap', '150'),
  ('daily_xp_cap', '4000'),
  ('daily_coin_cap', '1500'),
  ('import_xp_cap', '5000'),
  ('import_coin_cap', '2000'),
  ('premium_price_cents', '499');

-- ---------- profiles ----------
create table public.ig_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Hero' check (char_length(display_name) between 1 and 24 and display_name !~ '[<>]'),
  hero jsonb not null default '{}'::jsonb check (jsonb_typeof(hero) = 'object' and pg_column_size(hero) < 2048),
  lang text not null default 'en' check (lang in ('en', 'es')),
  public_profile boolean not null default false,
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  imported_local boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ig_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now()
);

create table public.ig_account_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  suspended boolean not null default false,
  reason text check (char_length(reason) <= 300),
  updated_at timestamptz not null default now()
);

-- ---------- billing mirror (written only by the Stripe webhook via the service role) ----------
create table public.ig_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.ig_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,  -- kept (anonymised) after account deletion for accounting
  provider text not null default 'stripe' check (provider in ('stripe', 'manual')),
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_id text not null default 'premium_monthly',
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz,          -- Stripe event `created` of the last applied event (out-of-order protection)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ig_subscriptions_user_idx on public.ig_subscriptions (user_id);

create table public.ig_payment_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  event_created timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'error')),
  amount_cents integer,
  user_id uuid,
  error text check (char_length(error) <= 500)
);

-- ---------- games ----------
create table public.ig_game_catalog (
  game_id text primary key check (game_id ~ '^[a-z]{2,20}$'),
  name text not null,
  access_tier text not null default 'free' check (access_tier in ('free', 'premium')),
  is_active boolean not null default true,
  sort_order integer not null default 100
);
insert into public.ig_game_catalog (game_id, name, sort_order) values
  ('pixelpact', 'Pixel Pact', 1), ('safari', 'Snack Squad Safari', 2), ('depths', 'Pixel Pact: Depths', 3),
  ('builders', 'Driftwood Builders', 4), ('tidelines', 'Tide Lines', 5), ('drift', 'Island Drift', 6),
  ('fit', 'Perfect Fit', 7), ('tray', 'Fail Tray', 8), ('junk', 'Junkyard to Jewel', 9), ('brew', 'Brew and Bloom', 10),
  ('trivia', 'Pact Trivia', 11), ('draw', 'Draw the Pact', 12), ('runner', 'Tide Runner', 13);

create table public.ig_game_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null references public.ig_game_catalog (game_id),
  best_score numeric,
  best_lower boolean not null default false,
  play_count integer not null default 0,
  completed_rounds integer not null default 0,
  last_played_at timestamptz,
  primary key (user_id, game_id)
);

create table public.ig_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null references public.ig_game_catalog (game_id),
  client_key text not null check (char_length(client_key) between 8 and 64),
  access_type text not null check (access_type in ('free', 'premium', 'admin')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  unique (user_id, client_key, game_id)
);
create index ig_game_sessions_user_started_idx on public.ig_game_sessions (user_id, started_at desc);
create index ig_game_sessions_game_started_idx on public.ig_game_sessions (game_id, started_at desc);

create table public.ig_session_rounds (
  session_id uuid not null references public.ig_game_sessions (id) on delete cascade,
  round_key text not null check (char_length(round_key) between 1 and 64),
  user_id uuid not null,
  game_id text not null,
  score numeric,
  xp integer not null default 0,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (session_id, round_key)
);
create index ig_session_rounds_user_created_idx on public.ig_session_rounds (user_id, created_at desc);
create index ig_session_rounds_game_created_idx on public.ig_session_rounds (game_id, created_at desc);

create table public.ig_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  starts integer not null default 0 check (starts >= 0),
  xp_earned integer not null default 0,
  coins_earned integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- ---------- achievements ----------
create table public.ig_achievements (
  id serial primary key,
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  title_en text not null, title_es text not null,
  desc_en text not null, desc_es text not null,
  icon text not null default '🏅',
  category text not null default 'general',
  is_active boolean not null default true
);
insert into public.ig_achievements (code, title_en, title_es, desc_en, desc_es, icon, category) values
  ('first_round', 'First round', 'Primera ronda', 'Finish your first round of any game.', 'Termina tu primera ronda de cualquier juego.', '🎉', 'general'),
  ('five_rounds', 'Warming up', 'Calentando', 'Finish 5 rounds.', 'Termina 5 rondas.', '🔥', 'general'),
  ('fifty_rounds', 'Regular', 'Habitual', 'Finish 50 rounds.', 'Termina 50 rondas.', '⭐', 'general'),
  ('three_games', 'Explorer', 'Explorador', 'Finish a round in 3 different games.', 'Termina una ronda en 3 juegos distintos.', '🧭', 'general'),
  ('all_games', 'Completionist', 'Lo probé todo', 'Finish a round in every game.', 'Termina una ronda en todos los juegos.', '🏆', 'general'),
  ('first_best', 'Personal best', 'Récord personal', 'Set a personal best in any game.', 'Consigue un récord personal en cualquier juego.', '📈', 'skill'),
  ('three_days', 'Coming back', 'Vuelvo', 'Play on 3 different days.', 'Juega en 3 días distintos.', '📅', 'habit'),
  ('level_5', 'Hero level 5', 'Héroe nivel 5', 'Reach hero level 5.', 'Llega al nivel 5 de héroe.', '🛡️', 'progress'),
  ('level_10', 'Hero level 10', 'Héroe nivel 10', 'Reach hero level 10.', 'Llega al nivel 10 de héroe.', '👑', 'progress');

create table public.ig_user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id integer not null references public.ig_achievements (id),
  earned_at timestamptz not null default now(),
  source text check (char_length(source) <= 60),
  primary key (user_id, achievement_id)
);

-- ---------- analytics + audit (no client access) ----------
create table public.ig_events (
  id bigserial primary key,
  user_id uuid,
  name text not null check (name ~ '^[a-z_]{3,40}$'),
  game_id text,
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 1024),
  created_at timestamptz not null default now()
);
create index ig_events_name_created_idx on public.ig_events (name, created_at desc);
create index ig_events_user_created_idx on public.ig_events (user_id, created_at desc);

create table public.ig_admin_audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- RLS: on everywhere, deny by default ----------
alter table public.ig_app_config enable row level security;
alter table public.ig_profiles enable row level security;
alter table public.ig_user_roles enable row level security;
alter table public.ig_account_status enable row level security;
alter table public.ig_customers enable row level security;
alter table public.ig_subscriptions enable row level security;
alter table public.ig_payment_webhook_events enable row level security;
alter table public.ig_game_catalog enable row level security;
alter table public.ig_game_progress enable row level security;
alter table public.ig_game_sessions enable row level security;
alter table public.ig_session_rounds enable row level security;
alter table public.ig_daily_usage enable row level security;
alter table public.ig_achievements enable row level security;
alter table public.ig_user_achievements enable row level security;
alter table public.ig_events enable row level security;
alter table public.ig_admin_audit_logs enable row level security;

-- Table privileges: start from nothing, then grant the minimum. (Supabase grants broad defaults to anon/authenticated.)
-- Scoped to this app's ig_* objects only: the schema may be shared with other apps (e.g. a Supabase project that also hosts la_* tables).
do $$ declare r record; begin
  for r in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'ig\_%' and c.relkind in ('r', 'S', 'v') loop
    execute format(case when r.relkind = 'S' then 'revoke all on sequence public.%I from anon, authenticated' else 'revoke all on table public.%I from anon, authenticated' end, r.relname);
  end loop;
end $$;

grant select on public.ig_game_catalog, public.ig_achievements to anon, authenticated;
create policy catalog_read on public.ig_game_catalog for select to anon, authenticated using (is_active);
create policy achievements_read on public.ig_achievements for select to anon, authenticated using (is_active);

grant select on public.ig_profiles to authenticated;
grant update (display_name, hero, lang, public_profile) on public.ig_profiles to authenticated;
create policy profiles_read_own on public.ig_profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.ig_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on public.ig_account_status, public.ig_subscriptions, public.ig_game_progress, public.ig_game_sessions, public.ig_daily_usage, public.ig_user_achievements to authenticated;
create policy status_read_own on public.ig_account_status for select to authenticated using (user_id = auth.uid());
create policy subs_read_own on public.ig_subscriptions for select to authenticated using (user_id = auth.uid());
create policy progress_read_own on public.ig_game_progress for select to authenticated using (user_id = auth.uid());
create policy sessions_read_own on public.ig_game_sessions for select to authenticated using (user_id = auth.uid());
create policy usage_read_own on public.ig_daily_usage for select to authenticated using (user_id = auth.uid());
create policy ach_read_own on public.ig_user_achievements for select to authenticated using (user_id = auth.uid());
-- user_roles, customers, payment_webhook_events, session_rounds, events, admin_audit_logs, app_config: no grants, no policies → invisible to clients.

-- keep updated_at honest
create function public.ig_touch_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;
create trigger ig_profiles_touch before update on public.ig_profiles for each row execute function public.ig_touch_updated_at();
create trigger ig_subscriptions_touch before update on public.ig_subscriptions for each row execute function public.ig_touch_updated_at();
