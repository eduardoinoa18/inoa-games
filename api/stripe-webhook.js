// POST /api/stripe-webhook — Stripe → us. The ONLY path that changes premium status.
// Verifies the signature on the raw body, then hands the event to the idempotent, order-aware SQL function
// public.apply_billing_event (duplicates and stale out-of-order events are ignored there). Non-2xx makes Stripe retry.
const L = require('./_lib');
const HANDLED = new Set(['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded']);
module.exports = L.handle(async (req, res) => {
  const raw = await L.rawBody(req);
  if (!L.verifyStripeSignature(raw, req.headers['stripe-signature'], L.env('STRIPE_WEBHOOK_SECRET'))) return L.send(res, 400, { error: 'bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return L.send(res, 400, { error: 'bad json' }); }
  if (!ev || typeof ev.id !== 'string' || !ev.type || !ev.data || !ev.data.object) return L.send(res, 400, { error: 'bad event' });
  if (!HANDLED.has(ev.type)) return L.send(res, 200, { received: true, ignored: true });
  const out = await L.supa('/rest/v1/rpc/apply_billing_event', { body: { p_event_id: ev.id, p_type: ev.type, p_created: new Date((ev.created || 0) * 1000).toISOString(), p_obj: ev.data.object } });
  L.send(res, 200, { received: true, result: out && out.status });
});
module.exports.config = { api: { bodyParser: false } };
