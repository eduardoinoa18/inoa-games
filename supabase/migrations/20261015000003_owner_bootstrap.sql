-- Owner (master admin) bootstrap. These functions have NO execute grant for anon/authenticated/service_role:
-- only the database owner can run them, i.e. the project owner in the Supabase SQL editor (dashboard login + MFA).
-- Usage: supabase/admin/grant_owner.sql. No email, password or key is stored in the repo.
create function public.ig_grant_owner_by_email(p_email text) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; verified timestamptz;
begin
  select id, email_confirmed_at into uid, verified from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then raise exception 'no account with that email — sign up on the site first'; end if;
  if verified is null then raise exception 'verify the email address first'; end if;
  perform public.ig_ensure_profile(uid);
  insert into public.ig_user_roles (user_id, role) values (uid, 'admin') on conflict (user_id) do update set role = 'admin', granted_at = now();
  insert into public.ig_admin_audit_logs (actor_user_id, action, target_type, target_id, metadata) values (null, 'grant_admin', 'user', uid::text, jsonb_build_object('via', 'sql_bootstrap'));
  return uid;
end $$;
create function public.ig_revoke_owner_by_email(p_email text) returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.ig_user_roles where user_id in (select id from auth.users where lower(email) = lower(btrim(p_email)));
  get diagnostics n = row_count;
  insert into public.ig_admin_audit_logs (action, target_type, target_id, metadata) values ('revoke_admin', 'email', md5(lower(btrim(p_email))), jsonb_build_object('rows', n));
  return n;
end $$;
revoke execute on function public.ig_grant_owner_by_email(text), public.ig_revoke_owner_by_email(text) from public, anon, authenticated, service_role;
