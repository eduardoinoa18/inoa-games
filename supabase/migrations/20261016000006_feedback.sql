-- Beta feedback: players (signed in or guest) send a rating + short note from any game or the hub; the owner reads it in admin.html.
-- No email or device fingerprint is collected; signed-in feedback links to the account (shown to the owner only).
create table public.ig_feedback (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  game_id text check (game_id is null or game_id ~ '^[a-z]{2,20}$'),
  rating smallint check (rating between 1 and 5),
  kind text not null default 'general' check (kind in ('general', 'bug', 'idea', 'praise')),
  body text check (char_length(body) <= 1000),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) < 1024),  -- app version, platform (web/ios/android), language, screen size
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now(),
  check (rating is not null or char_length(coalesce(body, '')) > 0)
);
create index ig_feedback_created_idx on public.ig_feedback (created_at desc);
alter table public.ig_feedback enable row level security;
revoke all on table public.ig_feedback from anon, authenticated;
revoke all on sequence public.ig_feedback_id_seq from anon, authenticated;
insert into public.ig_app_config (key, value) values ('feedback_per_user_day', '20'), ('feedback_guest_per_hour', '300') on conflict (key) do nothing;

create function public.ig_submit_feedback(p_rating integer default null, p_body text default null, p_game text default null, p_kind text default 'general', p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int; b text := nullif(btrim(left(regexp_replace(coalesce(p_body, ''), '[<>]', '', 'g'), 1000)), ''); ctx jsonb := '{}'::jsonb;
begin
  if p_rating is not null and p_rating not between 1 and 5 then return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  if p_rating is null and b is null then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if uid is not null then
    select count(*) into n from public.ig_feedback where user_id = uid and created_at > now() - interval '1 day';
    if n >= public.ig_cfg_int('feedback_per_user_day') then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  else
    select count(*) into n from public.ig_feedback where user_id is null and created_at > now() - interval '1 hour';
    if n >= public.ig_cfg_int('feedback_guest_per_hour') then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  end if;
  -- keep only known, short context fields
  if jsonb_typeof(p_context) = 'object' then
    select coalesce(jsonb_object_agg(key, left(value #>> '{}', 40)), '{}'::jsonb) into ctx from jsonb_each(p_context)
      where key in ('platform', 'version', 'lang', 'screen', 'page', 'mode');
  end if;
  insert into public.ig_feedback (user_id, game_id, rating, kind, body, context)
    values (uid, case when exists (select 1 from public.ig_game_catalog where game_id = p_game) then p_game end, p_rating,
            case when p_kind in ('general', 'bug', 'idea', 'praise') then p_kind else 'general' end, b, ctx);
  perform public.ig_log_event(uid, 'feedback_sent', p_game, jsonb_build_object('rating', p_rating));
  return jsonb_build_object('ok', true);
end $$;

create function public.ig_admin_feedback(p_limit integer default 50, p_offset integer default 0, p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ig_require_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.ig_feedback where p_status is null or status = p_status),
    'new', (select count(*) from public.ig_feedback where status = 'new'),
    'avg_rating_30d', (select round(avg(rating)::numeric, 2) from public.ig_feedback where rating is not null and created_at > now() - interval '30 days'),
    'items', (select coalesce(jsonb_agg(row_to_json(f) order by f.created_at desc), '[]'::jsonb) from (
      select fb.id, fb.created_at, fb.game_id, fb.rating, fb.kind, fb.body, fb.context, fb.status, p.display_name, u.email
      from public.ig_feedback fb left join auth.users u on u.id = fb.user_id left join public.ig_profiles p on p.id = fb.user_id
      where p_status is null or fb.status = p_status order by fb.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) f));
end $$;

create function public.ig_admin_feedback_set_status(p_id bigint, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.ig_require_admin();
begin
  if p_status not in ('new', 'read', 'done') then raise exception 'bad_status'; end if;
  update public.ig_feedback set status = p_status where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

revoke execute on function public.ig_submit_feedback(integer, text, text, text, jsonb), public.ig_admin_feedback(integer, integer, text),
  public.ig_admin_feedback_set_status(bigint, text) from public, anon, authenticated;
grant execute on function public.ig_submit_feedback(integer, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.ig_admin_feedback(integer, integer, text), public.ig_admin_feedback_set_status(bigint, text) to authenticated;
