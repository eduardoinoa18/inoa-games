// Shared helpers for the Vercel serverless functions (Node 18+, no dependencies).
// Secrets come ONLY from environment variables (Vercel project settings): never from the repo or the browser.
const crypto = require('crypto');

const env = (k) => { const v = process.env[k]; if (!v) throw Object.assign(new Error('missing env ' + k), { status: 500, public: 'Server not configured' }); return v; };
const fetchImpl = (...a) => (module.exports._fetch || fetch)(...a); // tests swap _fetch for a fake

function send(res, status, body, headers = {}) {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
async function rawBody(req) { if (typeof req.body === 'string') return req.body; if (Buffer.isBuffer(req.body)) return req.body.toString('utf8'); const chunks = []; for await (const c of req) chunks.push(Buffer.from(c)); return Buffer.concat(chunks).toString('utf8'); }

// ---- Supabase (service role: bypasses RLS, so only used for the narrow jobs below) ----
async function supa(path, { method = 'POST', body, token } = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + path, key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetchImpl(url, { method, headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, (token || /^eyJ/.test(key)) ? { Authorization: 'Bearer ' + (token || key) } : {}), body: body == null ? undefined : JSON.stringify(body) });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) throw Object.assign(new Error('supabase ' + r.status + ' ' + (data && data.message || '')), { status: 502 });
  return data;
}
// The caller's identity comes from their Supabase access token, validated by Supabase itself (never from a request field).
async function userFromRequest(req) {
  const auth = String(req.headers.authorization || ''); const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok || tok.length > 4096) throw Object.assign(new Error('no token'), { status: 401, public: 'Sign in first' });
  const url = env('SUPABASE_URL').replace(/\/$/, '') + '/auth/v1/user';
  const r = await fetchImpl(url, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw Object.assign(new Error('bad token'), { status: 401, public: 'Sign in again' });
  const u = await r.json(); if (!u || !u.id) throw Object.assign(new Error('bad user'), { status: 401, public: 'Sign in again' });
  return { id: u.id, email: u.email, verified: !!u.email_confirmed_at, token: tok };
}

// ---- Stripe (REST, form-encoded) ----
function stripeKey() {
  const k = env('STRIPE_SECRET_KEY');
  // second lock against accidental live charges: live keys only work when the owner has explicitly enabled them
  if (k.startsWith('sk_live_') && process.env.STRIPE_LIVE_ENABLED !== 'yes') throw Object.assign(new Error('live billing locked'), { status: 503, public: 'Payments are not open yet' });
  return k;
}
const form = (obj, prefix = '', out = []) => { for (const [k, v] of Object.entries(obj)) { if (v == null) continue; const key = prefix ? `${prefix}[${k}]` : k; if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v))); } return out.join('&'); };
async function stripe(path, { method = 'POST', params } = {}) {
  const r = await fetchImpl('https://api.stripe.com/v1' + path + (method === 'GET' && params ? '?' + form(params) : ''), { method, headers: { Authorization: 'Bearer ' + stripeKey(), 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: method === 'GET' || !params ? undefined : form(params) });
  const data = await r.json(); if (!r.ok) throw Object.assign(new Error('stripe ' + r.status + ' ' + (data.error && data.error.message)), { status: 502 });
  return data;
}
// Stripe-Signature: t=<unix>,v1=<hex hmac-sha256 of "t.payload">[,v1=…]. Constant-time compare, 5-minute tolerance.
function verifyStripeSignature(payload, header, secret, toleranceSec = 300, now = Math.floor(Date.now() / 1000)) {
  const parts = String(header || '').split(','); const t = (parts.find(p => p.startsWith('t=')) || '').slice(2); const sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false; if (Math.abs(now - Number(t)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex');
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
const siteUrl = () => env('SITE_URL').replace(/\/$/, '');
function handle(fn) { return async (req, res) => { try { if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }, { Allow: 'POST' }); await fn(req, res); } catch (e) { const st = e.status || 500; if (st >= 500) console.error('[api]', e.message); send(res, st, { error: e.public || (st >= 500 ? 'Something went wrong' : e.message) }); } }; }

module.exports = { env, send, rawBody, supa, userFromRequest, stripe, verifyStripeSignature, siteUrl, handle, form, _fetch: null };
