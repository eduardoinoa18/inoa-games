-- Account deletion support (called by api/account-delete.js with the service role, after re-authentication in the UI).
-- Analytics events are kept for aggregate KPIs but unlinked from the person; billing rows survive with user_id = null
-- (subscriptions.user_id is ON DELETE SET NULL) because payment records must be retained for accounting.
create function public.ig_forget_user(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.ig_events set user_id = null, props = props - 'code' where user_id = p_user;
  get diagnostics n = row_count;
  update public.ig_payment_webhook_events set user_id = null where user_id = p_user;
  insert into public.ig_admin_audit_logs (action, target_type, target_id, metadata) values ('account_deleted', 'user', md5(p_user::text), jsonb_build_object('events_unlinked', n));
  return jsonb_build_object('events_unlinked', n);
end $$;
revoke execute on function public.ig_forget_user(uuid) from public, anon, authenticated;
grant execute on function public.ig_forget_user(uuid) to service_role;
