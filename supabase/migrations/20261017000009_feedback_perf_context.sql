-- Real-device pass (roadmap R1): feedback also keeps the frame rate the game was running at, whether the engine dropped
-- quality, and a coarse device class ("android chrome 8c"). No model names, IDs or fingerprints. Same 40-char cap per field.
create or replace function public.ig_submit_feedback(p_rating integer default null, p_body text default null, p_game text default null, p_kind text default 'general', p_context jsonb default '{}'::jsonb)
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
      where key in ('platform', 'version', 'lang', 'screen', 'page', 'mode', 'device', 'fps', 'quality');
  end if;
  insert into public.ig_feedback (user_id, game_id, rating, kind, body, context)
    values (uid, case when exists (select 1 from public.ig_game_catalog where game_id = p_game) then p_game end, p_rating,
            case when p_kind in ('general', 'bug', 'idea', 'praise') then p_kind else 'general' end, b, ctx);
  perform public.ig_log_event(uid, 'feedback_sent', p_game, jsonb_build_object('rating', p_rating));
  return jsonb_build_object('ok', true);
end $$;

-- New games (roadmap R8/R9): ig_start_game refuses ids missing from the catalog. Added inactive (the "play every game"
-- achievement counts active games); a later migration activates each one when its page ships.
insert into public.ig_game_catalog (game_id, name, sort_order, is_active) values ('dominoes', 'Dominoes', 14, false), ('bubbles', 'Bubble Pop Counting', 15, false) on conflict (game_id) do nothing;
