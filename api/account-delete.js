// POST /api/account-delete (Bearer token; the UI re-authenticates with the password right before calling).
// Cancels any Stripe subscription immediately, unlinks analytics events, then deletes the auth user (cascades to profile,
// progress, sessions, achievements). Billing rows are kept with user_id = null for accounting (see docs/PRIVACY data retention).
const L = require('./_lib');
module.exports = L.handle(async (req, res) => {
  const user = await L.userFromRequest(req);
  const subs = await L.supa('/rest/v1/ig_subscriptions?select=provider_subscription_id,status&provider=eq.stripe&user_id=eq.' + user.id + '&status=in.(active,trialing,past_due)', { method: 'GET' });
  for (const s of subs || []) if (s.provider_subscription_id) await L.stripe('/subscriptions/' + encodeURIComponent(s.provider_subscription_id), { method: 'DELETE' });
  await L.supa('/rest/v1/rpc/ig_forget_user', { body: { p_user: user.id } });
  await L.supa('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
  L.send(res, 200, { deleted: true });
});
