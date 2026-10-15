// Billing + account API tests: the real api/*.js handlers against the mock Supabase (real migrations on local Postgres)
// and a fake Stripe that records calls. Webhooks are signed exactly like Stripe signs them.
// usage: node test/api.test.js   (needs the local Postgres from test/db/README.md)   → API_TESTS_PASSED
const { execSync } = require('child_process'), crypto = require('crypto'), path = require('path');
const MP = 54340, DB = 'inoa_api';
Object.assign(process.env, { SUPABASE_URL: `http://localhost:${MP}`, SUPABASE_ANON_KEY: 'test-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_ID: 'price_premium_499', SITE_URL: 'https://inoa.example', BILLING_ENABLED: 'yes' });
const L = require('../api/_lib');
const H = { checkout: require('../api/checkout'), portal: require('../api/portal'), webhook: require('../api/stripe-webhook'), del: require('../api/account-delete') };
let fails = 0; const ok = (c, m) => { if (c) console.log('ok -', m); else { fails++; console.log('FAIL -', m); } };
const stripeCalls = [];
L._fetch = async (url, init = {}) => {
  if (String(url).startsWith('https://api.stripe.com/')) {
    stripeCalls.push({ url: String(url), method: init.method, body: init.body || '' }); const p = new URL(url).pathname;
    const j = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
    if (p === '/v1/checkout/sessions') return j({ id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' });
    if (p === '/v1/billing_portal/sessions') return j({ url: 'https://billing.stripe.test/p_1' });
    if (p.startsWith('/v1/subscriptions/') && init.method === 'DELETE') return j({ id: p.split('/').pop(), status: 'canceled' });
    return j({ error: { message: 'unexpected' } }, 400);
  }
  return fetch(url, init);
};
function call(handler, { method = 'POST', headers = {}, body = '' } = {}) {
  return new Promise(resolve => {
    const req = { method, headers, body: typeof body === 'string' ? body : JSON.stringify(body), [Symbol.asyncIterator]: async function* () { } };
    const res = { statusCode: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
    handler(req, res);
  });
}
const sign = (payload, t = Math.floor(Date.now() / 1000), secret = 'whsec_test') => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
const event = (id, type, obj, created = Math.floor(Date.now() / 1000)) => JSON.stringify({ id, type, created, data: { object: obj } });

(async () => {
  execSync(`bash ${path.join(__dirname, 'db/setup.sh')} ${DB}`, { stdio: 'pipe' });
  const mock = await require('./platform/mock-supabase.js')({ port: MP, db: DB });
  const A = { apikey: 'test-anon-key', 'content-type': 'application/json' };
  const api = (p, init) => fetch(`http://localhost:${MP}${p}`, Object.assign({ headers: A }, init)).then(r => r.json());
  const sql = (q, params) => api('/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) });
  const signup = async (email, verify = true) => { await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'password-123', data: { display_name: email.split('@')[0], app: 'inoa' } }) }); if (!verify) { const t = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: 'password-123' }) }); return t; } const link = (await api(`/__test/confirm?email=${email}`)).link; const q = new URLSearchParams(link.split('#')[1]); const u = (await sql('select id from auth.users where email = $1', [email]))[0]; return { token: q.get('access_token'), id: u.id }; };
  try {
    const kim = await signup('kim@example.test');
    const auth = t => ({ authorization: 'Bearer ' + t });
    // ---- checkout ----
    process.env.BILLING_ENABLED = ''; ok((await call(H.checkout, { headers: auth(kim.token) })).status === 503, 'free beta: checkout refused unless BILLING_ENABLED=yes'); process.env.BILLING_ENABLED = 'yes';
    ok((await call(H.checkout, {})).status === 401, 'checkout without a token → 401');
    ok((await call(H.checkout, { method: 'GET' })).status === 405, 'GET → 405');
    ok((await call(H.checkout, { headers: auth('forged.jwt.token') })).status === 401, 'checkout with a forged token → 401');
    await sql("update auth.users set email_confirmed_at = null where email = 'kim@example.test'");
    ok((await call(H.checkout, { headers: auth(kim.token) })).status === 403, 'unverified email cannot check out');
    await sql("update auth.users set email_confirmed_at = now() where email = 'kim@example.test'");
    const co = await call(H.checkout, { headers: auth(kim.token), body: { price: 'price_cheap', user_id: '00000000-0000-0000-0000-000000000000' } });
    ok(co.status === 200 && /checkout\.stripe\.test/.test(co.body.url), 'checkout → Stripe Checkout URL');
    const cs = decodeURIComponent(stripeCalls.at(-1).body);
    ok(cs.includes('line_items[0][price]=price_premium_499') && !cs.includes('price_cheap'), 'price comes from the server env, not the request');
    ok(cs.includes(`client_reference_id=${kim.id}`) && cs.includes(`subscription_data[metadata][user_id]=${kim.id}`) && !cs.includes('00000000-0000-0000-0000-000000000000'), 'user id comes from the verified token, not the request');
    ok(cs.includes('success_url=https://inoa.example/pricing.html?checkout=success'), 'redirects go to SITE_URL only');
    process.env.STRIPE_SECRET_KEY = 'sk_live_x'; ok((await call(H.checkout, { headers: auth(kim.token) })).status === 503, 'live key refused unless STRIPE_LIVE_ENABLED=yes'); process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    // ---- webhook: signature checks ----
    const now = Math.floor(Date.now() / 1000), sub = { id: 'sub_k1', customer: 'cus_k1', status: 'active', cancel_at_period_end: false, current_period_start: now, current_period_end: now + 30 * 86400, metadata: { user_id: kim.id } };
    const e1 = event('evt_k1', 'customer.subscription.created', sub, now - 10);
    ok((await call(H.webhook, { headers: { 'stripe-signature': 'nope' }, body: e1 })).status === 400, 'webhook without a valid signature → 400');
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(e1, now, 'whsec_wrong') }, body: e1 })).status === 400, 'webhook signed with the wrong secret → 400');
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(e1, now - 900) }, body: e1 })).status === 400, 'webhook with an old timestamp (replay) → 400');
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(e1) }, body: e1.replace('"active"', '"trialing"').replace('kim', 'kim') + ' ' })).status === 400, 'tampered body → 400');
    const w1 = await call(H.webhook, { headers: { 'stripe-signature': sign(e1) }, body: e1 });
    ok(w1.status === 200 && w1.body.result === 'processed', 'valid subscription.created → processed');
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(e1) }, body: e1 })).body.result === 'duplicate', 'Stripe retry of the same event → duplicate (idempotent)');
    let st = (await sql('select status, cancel_at_period_end from public.ig_subscriptions where provider_subscription_id = $1', ['sub_k1']))[0];
    ok(st && st.status === 'active', 'subscription mirrored as active');
    ok((await call(H.checkout, { headers: auth(kim.token) })).status === 409, 'second checkout while premium → 409');
    const stale = event('evt_k0', 'customer.subscription.updated', Object.assign({}, sub, { status: 'canceled' }), now - 3600);
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(stale) }, body: stale })).body.result === 'stale', 'late out-of-order event ignored');
    const paid = event('evt_k2', 'invoice.paid', { customer: 'cus_k1', amount_paid: 499 });
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(paid) }, body: paid })).body.result === 'processed', 'invoice.paid recorded');
    const failed = event('evt_k3', 'invoice.payment_failed', { customer: 'cus_k1', amount_due: 499 });
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(failed) }, body: failed })).body.result === 'processed', 'invoice.payment_failed recorded');
    const pd = event('evt_k4', 'customer.subscription.updated', Object.assign({}, sub, { status: 'past_due' }), now + 5);
    await call(H.webhook, { headers: { 'stripe-signature': sign(pd) }, body: pd });
    const kimStatus = async () => (await sql("select public.ig_entitlement($1::uuid) as e", [kim.id]))[0].e;
    ok(await kimStatus() === 'premium', 'past_due keeps access until the paid period ends (no invented grace)');
    const cancel = event('evt_k5', 'customer.subscription.updated', Object.assign({}, sub, { cancel_at_period_end: true }), now + 10);
    await call(H.webhook, { headers: { 'stripe-signature': sign(cancel) }, body: cancel });
    ok(await kimStatus() === 'premium', 'cancel at period end: still premium until the end');
    const refund = event('evt_k6', 'charge.refunded', { customer: 'cus_k1', amount_refunded: 499 });
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(refund) }, body: refund })).body.result === 'processed', 'charge.refunded recorded');
    const ignored = event('evt_k7', 'customer.created', { id: 'cus_k1' });
    ok((await call(H.webhook, { headers: { 'stripe-signature': sign(ignored) }, body: ignored })).body.ignored === true, 'unhandled event types acknowledged but ignored');
    const del = event('evt_k8', 'customer.subscription.deleted', Object.assign({}, sub, { status: 'canceled', current_period_end: now - 1 }), now + 20);
    await call(H.webhook, { headers: { 'stripe-signature': sign(del) }, body: del });
    ok(await kimStatus() === 'free', 'subscription.deleted → back to free');
    // ---- portal ----
    const pt = await call(H.portal, { headers: auth(kim.token) }); ok(pt.status === 200 && /billing\.stripe\.test/.test(pt.body.url), 'billing portal URL for a customer');
    const lee = await signup('lee@example.test');
    ok((await call(H.portal, { headers: auth(lee.token) })).status === 404, 'no portal for someone who never paid');
    // ---- account deletion ----
    const resub = event('evt_k9', 'customer.subscription.created', Object.assign({}, sub, { id: 'sub_k2' }), now + 30);
    await call(H.webhook, { headers: { 'stripe-signature': sign(resub) }, body: resub });
    stripeCalls.length = 0;
    const d = await call(H.del, { headers: auth(kim.token) }); ok(d.status === 200, 'account deletion succeeds');
    ok(stripeCalls.some(c => c.method === 'DELETE' && c.url.endsWith('/v1/subscriptions/sub_k2')), 'active Stripe subscription cancelled before deletion');
    ok(!(await sql('select 1 from auth.users where id = $1', [kim.id])).length && !(await sql('select 1 from public.ig_profiles where id = $1', [kim.id])).length, 'auth user + profile removed');
    ok((await sql("select count(*)::int as n from public.ig_subscriptions where provider_subscription_id in ('sub_k1','sub_k2') and user_id is null"))[0].n === 2, 'billing records kept, unlinked from the person');
    ok((await sql('select count(*)::int as n from public.ig_events where user_id = $1', [kim.id]))[0].n === 0, 'analytics events unlinked');
    ok((await call(H.checkout, { headers: auth(kim.token) })).status === 401, 'deleted account token no longer works');
  } catch (e) { fails++; console.log('FAIL - exception', e.stack); }
  await mock.close();
  console.log(fails ? `API_TESTS_FAILED (${fails})` : 'API_TESTS_PASSED'); process.exit(fails ? 1 : 0);
})();
