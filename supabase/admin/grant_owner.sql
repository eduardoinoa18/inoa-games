-- Run ONCE in the Supabase dashboard → SQL editor (as the project owner), after signing up on the site and verifying the email.
-- Replace the address below with the owner's sign-in email. Re-running is harmless. Audited in admin_audit_logs.
select public.ig_grant_owner_by_email('owner-email@example.com');
-- To remove admin from an old account (e.g. lost email access):  select public.ig_revoke_owner_by_email('old-address@example.com');
