-- Inoa Games platform: core schema, RLS, grants. Runs on Supabase Postgres (auth schema provided by Supabase).
-- Design: docs/PLATFORM_ARCHITECTURE.md. Every user-owned table has RLS on; clients only ever read their own rows,
-- and all writes that matter (progress, usage, subscriptions, roles) go through SECURITY DEFINER functions.

create extension if not exists pgcrypto;

-- ---------- tunables ----------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
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
create table public.profiles (
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

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now()
);

create table public.account_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  suspended boolean not null default false,
  reason text check (char_length(reason) <= 300),
  updated_at timestamptz not null default now()
);

-- ---------- billing mirror (written only by the Stripe webhook via the service role) ----------
create table public.customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
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
create index subscriptions_user_idx on public.subscriptions (user_id);

create table public.payment_webhook_events (
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
create table public.game_catalog (
  game_id text primary key check (game_id ~ '^[a-z]{2,20}$'),
  name text not null,
  access_tier text not null default 'free' check (access_tier in ('free', 'premium')),
  is_active boolean not null default true,
  sort_order integer not null default 100
);
insert into public.game_catalog (game_id, name, sort_order) values
  ('pixelpact', 'Pixel Pact', 1), ('safari', 'Snack Squad Safari', 2), ('depths', 'Pixel Pact: Depths', 3),
  ('builders', 'Driftwood Builders', 4), ('tidelines', 'Tide Lines', 5), ('drift', 'Island Drift', 6),
  ('fit', 'Perfect Fit', 7), ('tray', 'Fail Tray', 8), ('junk', 'Junkyard to Jewel', 9), ('brew', 'Brew and Bloom', 10),
  ('trivia', 'Pact Trivia', 11), ('draw', 'Draw the Pact', 12), ('runner', 'Tide Runner', 13);

create table public.game_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null references public.game_catalog (game_id),
  best_score numeric,
  best_lower boolean not null default false,
  play_count integer not null default 0,
  completed_rounds integer not null default 0,
  last_played_at timestamptz,
  primary key (user_id, game_id)
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null references public.game_catalog (game_id),
  client_key text not null check (char_length(client_key) between 8 and 64),
  access_type text not null check (access_type in ('free', 'premium', 'admin')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  unique (user_id, client_key, game_id)
);
create index game_sessions_user_started_idx on public.game_sessions (user_id, started_at desc);
create index game_sessions_game_started_idx on public.game_sessions (game_id, started_at desc);

create table public.session_rounds (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_key text not null check (char_length(round_key) between 1 and 64),
  user_id uuid not null,
  game_id text not null,
  score numeric,
  xp integer not null default 0,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (session_id, round_key)
);
create index session_rounds_user_created_idx on public.session_rounds (user_id, created_at desc);
create index session_rounds_game_created_idx on public.session_rounds (game_id, created_at desc);

create table public.daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  starts integer not null default 0 check (starts >= 0),
  xp_earned integer not null default 0,
  coins_earned integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- ---------- achievements ----------
create table public.achievements (
  id serial primary key,
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  title_en text not null, title_es text not null,
  desc_en text not null, desc_es text not null,
  icon text not null default '🏅',
  category text not null default 'general',
  is_active boolean not null default true
);
insert into public.achievements (code, title_en, title_es, desc_en, desc_es, icon, category) values
  ('first_round', 'First round', 'Primera ronda', 'Finish your first round of any game.', 'Termina tu primera ronda de cualquier juego.', '🎉', 'general'),
  ('five_rounds', 'Warming up', 'Calentando', 'Finish 5 rounds.', 'Termina 5 rondas.', '🔥', 'general'),
  ('fifty_rounds', 'Regular', 'Habitual', 'Finish 50 rounds.', 'Termina 50 rondas.', '⭐', 'general'),
  ('three_games', 'Explorer', 'Explorador', 'Finish a round in 3 different games.', 'Termina una ronda en 3 juegos distintos.', '🧭', 'general'),
  ('all_games', 'Completionist', 'Lo probé todo', 'Finish a round in every game.', 'Termina una ronda en todos los juegos.', '🏆', 'general'),
  ('first_best', 'Personal best', 'Récord personal', 'Set a personal best in any game.', 'Consigue un récord personal en cualquier juego.', '📈', 'skill'),
  ('three_days', 'Coming back', 'Vuelvo', 'Play on 3 different days.', 'Juega en 3 días distintos.', '📅', 'habit'),
  ('level_5', 'Hero level 5', 'Héroe nivel 5', 'Reach hero level 5.', 'Llega al nivel 5 de héroe.', '🛡️', 'progress'),
  ('level_10', 'Hero level 10', 'Héroe nivel 10', 'Reach hero level 10.', 'Llega al nivel 10 de héroe.', '👑', 'progress');

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id integer not null references public.achievements (id),
  earned_at timestamptz not null default now(),
  source text check (char_length(source) <= 60),
  primary key (user_id, achievement_id)
);

-- ---------- analytics + audit (no client access) ----------
create table public.events (
  id bigserial primary key,
  user_id uuid,
  name text not null check (name ~ '^[a-z_]{3,40}$'),
  game_id text,
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 1024),
  created_at timestamptz not null default now()
);
create index events_name_created_idx on public.events (name, created_at desc);
create index events_user_created_idx on public.events (user_id, created_at desc);

create table public.admin_audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- RLS: on everywhere, deny by default ----------
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.account_status enable row level security;
alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.game_catalog enable row level security;
alter table public.game_progress enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_rounds enable row level security;
alter table public.daily_usage enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Table privileges: start from nothing, then grant the minimum. (Supabase grants broad defaults to anon/authenticated.)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.game_catalog, public.achievements to anon, authenticated;
create policy catalog_read on public.game_catalog for select to anon, authenticated using (is_active);
create policy achievements_read on public.achievements for select to anon, authenticated using (is_active);

grant select on public.profiles to authenticated;
grant update (display_name, hero, lang, public_profile) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on public.account_status, public.subscriptions, public.game_progress, public.game_sessions, public.daily_usage, public.user_achievements to authenticated;
create policy status_read_own on public.account_status for select to authenticated using (user_id = auth.uid());
create policy subs_read_own on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy progress_read_own on public.game_progress for select to authenticated using (user_id = auth.uid());
create policy sessions_read_own on public.game_sessions for select to authenticated using (user_id = auth.uid());
create policy usage_read_own on public.daily_usage for select to authenticated using (user_id = auth.uid());
create policy ach_read_own on public.user_achievements for select to authenticated using (user_id = auth.uid());
-- user_roles, customers, payment_webhook_events, session_rounds, events, admin_audit_logs, app_config: no grants, no policies → invisible to clients.

-- keep updated_at honest
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
