// POST /api/portal (Bearer token) → { url } of the Stripe customer portal (update card, cancel, invoices).
const L = require('./_lib');
module.exports = L.handle(async (req, res) => {
  const user = await L.userFromRequest(req);
  const customer = await L.supa('/rest/v1/rpc/customer_for', { body: { uid: user.id } });
  if (!customer) return L.send(res, 404, { error: 'No billing account yet' });
  const s = await L.stripe('/billing_portal/sessions', { params: { customer, return_url: L.siteUrl() + '/account.html' } });
  L.send(res, 200, { url: s.url });
});
