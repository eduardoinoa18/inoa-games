// POST /api/checkout  (Authorization: Bearer <Supabase access token>) → { url } of a Stripe Checkout page for Premium ($4.99/month).
// The browser never chooses the price, the customer or the user id: all come from the server and the verified token.
const L = require('./_lib');
module.exports = L.handle(async (req, res) => {
  const user = await L.userFromRequest(req);
  if (!user.verified) return L.send(res, 403, { error: 'Verify your email first' });
  const [sub] = await L.supa('/rest/v1/subscriptions?select=status,current_period_end&user_id=eq.' + user.id + '&status=in.(active,trialing,past_due)&current_period_end=gt.' + new Date().toISOString(), { method: 'GET' });
  if (sub) return L.send(res, 409, { error: 'You already have Premium' });
  const customer = await L.supa('/rest/v1/rpc/customer_for', { body: { uid: user.id } });
  const site = L.siteUrl();
  const session = await L.stripe('/checkout/sessions', { params: {
    mode: 'subscription', line_items: { 0: { price: L.env('STRIPE_PRICE_ID'), quantity: 1 } },
    customer: customer || undefined, customer_email: customer ? undefined : user.email,
    client_reference_id: user.id, metadata: { user_id: user.id }, subscription_data: { metadata: { user_id: user.id } },
    success_url: site + '/pricing.html?checkout=success', cancel_url: site + '/pricing.html?checkout=cancel', allow_promotion_codes: 'false'
  } });
  L.send(res, 200, { url: session.url });
});
