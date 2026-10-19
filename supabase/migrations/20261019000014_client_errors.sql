-- Client error reports (engine/guard.js): pages that fail to load, crash, or lose WebGL report a short, anonymous record so
-- problems on real devices are visible. No account link, no IP, no personal data: page, kind, message, browser + screen.
create table public.ig_client_errors (
  id bigserial primary key,
  page text not null check (page ~ '^[a-z0-9_-]{1,30}$'),
  kind text not null check (kind in ('error', 'promise', 'load', 'webgl', 'boot')),
  message text not null check (char_length(message) <= 300),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 4096),
  created_at timestamptz not null default now()
);
create index ig_client_errors_created_idx on public.ig_client_errors (created_at desc);
alter table public.ig_client_errors enable row level security;
revoke all on table public.ig_client_errors from anon, authenticated;
revoke all on sequence public.ig_client_errors_id_seq from anon, authenticated;
insert into public.ig_app_config (key, value) values ('client_errors_per_minute', '120') on conflict (key) do nothing;

create function public.ig_log_error(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; pg text := lower(left(coalesce(p ->> 'page', ''), 30)); k text := p ->> 'kind'; d jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p) <> 'object' or pg !~ '^[a-z0-9_-]{1,30}$' or k not in ('error', 'promise', 'load', 'webgl', 'boot') then return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  select count(*) into n from public.ig_client_errors where created_at > now() - interval '1 minute';
  if n >= public.ig_cfg_int('client_errors_per_minute') then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  if jsonb_typeof(p -> 'detail') = 'object' then
    select coalesce(jsonb_object_agg(key, case when jsonb_typeof(value) in ('number', 'boolean', 'null') then value else to_jsonb(left(value #>> '{}', case when key = 'stack' then 1500 else 200 end)) end), '{}'::jsonb) into d
      from jsonb_each(p -> 'detail') where key in ('ua', 'w', 'h', 'dpr', 'ready', 'secs', 'online', 'mem', 'perf', 'at', 'stack', 'src', 'errors');
  end if;
  insert into public.ig_client_errors (page, kind, message, detail) values (pg, k, left(regexp_replace(coalesce(p ->> 'message', ''), '[<>]', '', 'g'), 300), d);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.ig_log_error(jsonb) to anon, authenticated;

-- owner view: newest reports + counts per page/kind over 7 days
create function public.ig_admin_client_errors(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ig_require_admin();
  return jsonb_build_object(
    'by_page', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (select page, kind, count(*) n from public.ig_client_errors where created_at > now() - interval '7 days' group by page, kind) x),
    'items', (select coalesce(jsonb_agg(row_to_json(e) order by e.created_at desc), '[]'::jsonb) from (select * from public.ig_client_errors order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) e));
end $$;
grant execute on function public.ig_admin_client_errors(integer) to authenticated;
