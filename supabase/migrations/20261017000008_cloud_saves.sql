-- Cloud game saves (roadmap R3, AUDIT Phase 0 F1): each game's own save (café, island, unlocks…) follows the signed-in
-- player between devices. One small JSON document per (player, save key). The client keeps working offline and pushes later.
-- Conflict rule: every write carries the revision it was based on; a stale write is refused with the newer copy so the client
-- can keep whichever was changed most recently (docs/PLATFORM_ARCHITECTURE.md §15). Rows are deleted with the account (FK cascade).

insert into public.ig_app_config (key, value) values ('save_max_bytes', '65536'), ('save_max_keys', '40') on conflict (key) do nothing;

create table public.ig_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9._-]{0,47}$'),
  data jsonb not null,
  bytes integer not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.ig_saves enable row level security;
revoke all on table public.ig_saves from anon, authenticated;

-- Metadata only (no data): what the client needs to decide what to pull.
create function public.ig_save_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'rev', rev, 'updated_at', updated_at, 'bytes', bytes) order by key) from public.ig_saves where user_id = uid), '[]'::jsonb);
end $$;

create function public.ig_save_get(p_keys jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); ks text[];
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys) > 40 then raise exception 'bad_keys' using errcode = '22023'; end if;
  ks := array(select jsonb_array_elements_text(p_keys));
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'data', data, 'rev', rev, 'updated_at', updated_at)) from public.ig_saves where user_id = uid and key = any (ks)), '[]'::jsonb);
end $$;

-- p_base_rev: the revision this write was based on (null = force, used after the client chose its copy in a conflict).
create function public.ig_save_put(p_key text, p_data jsonb, p_base_rev bigint default null) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int := octet_length(coalesce(p_data, 'null'::jsonb)::text); cur public.ig_saves;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9._-]{0,47}$' then raise exception 'bad_key' using errcode = '22023'; end if;
  if p_data is null then raise exception 'no_data' using errcode = '22023'; end if;
  if n > public.ig_cfg_int('save_max_bytes') then raise exception 'too_large' using errcode = '22023'; end if;
  perform public.ig_ensure_profile(uid);
  select * into cur from public.ig_saves where user_id = uid and key = p_key for update;
  if not found then
    if (select count(*) from public.ig_saves where user_id = uid) >= public.ig_cfg_int('save_max_keys') then raise exception 'too_many_keys' using errcode = '22023'; end if;
    insert into public.ig_saves (user_id, key, data, bytes) values (uid, p_key, p_data, n);
    return jsonb_build_object('ok', true, 'rev', 1);
  end if;
  if p_base_rev is not null and cur.rev <> p_base_rev then
    return jsonb_build_object('ok', false, 'conflict', true, 'rev', cur.rev, 'updated_at', cur.updated_at, 'data', cur.data);
  end if;
  update public.ig_saves set data = p_data, bytes = n, rev = cur.rev + 1, updated_at = now() where user_id = uid and key = p_key;
  return jsonb_build_object('ok', true, 'rev', cur.rev + 1);
end $$;

revoke execute on function public.ig_save_list(), public.ig_save_get(jsonb), public.ig_save_put(text, jsonb, bigint) from public, anon;
grant execute on function public.ig_save_list(), public.ig_save_get(jsonb), public.ig_save_put(text, jsonb, bigint) to authenticated;
