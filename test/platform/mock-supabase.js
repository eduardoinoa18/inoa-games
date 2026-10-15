// A small stand-in for Supabase's HTTP surface (GoTrue auth + PostgREST RPC/PATCH) backed by the real local Postgres,
// so engine/platform.js and the account/admin pages are tested end to end against the real migrations, RLS and RPCs.
// Only the endpoints engine/platform.js uses are implemented. TEST USE ONLY — passwords are kept in memory.
const http = require('http'), crypto = require('crypto'), { Pool } = require('pg');
const SECRET = 'test-jwt-secret';
const b64u = b => Buffer.from(b).toString('base64url');
const sign = (claims) => { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify(claims)); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url')}`; };
const verify = (tok) => { try { const [h, p, s] = tok.split('.'); if (crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url') !== s) return null; const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp > Date.now() / 1000 ? c : null; } catch (e) { return null; } };

module.exports = function start({ port, db = 'inoa_test', host = '/tmp/pgt', pgport = 55432, accessTtl = 3600 } = {}) {
  const pool = new Pool({ host, port: pgport, user: 'postgres', database: db, max: 8 });
  const pw = new Map(), refresh = new Map(), outbox = [];
  const session = (u) => { const exp = Math.floor(Date.now() / 1000) + accessTtl; const rt = crypto.randomBytes(16).toString('hex'); refresh.set(rt, u.id); return { access_token: sign({ sub: u.id, email: u.email, role: 'authenticated', exp }), refresh_token: rt, expires_in: accessTtl, expires_at: exp, token_type: 'bearer', user: { id: u.id, email: u.email } }; };
  const hash = (p, salt = crypto.randomBytes(8).toString('hex')) => salt + ':' + crypto.scryptSync(p, salt, 32).toString('hex');
  const check = (p, h) => { const [salt] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(hash(p, salt)), Buffer.from(h)); };
  async function asUser(claims, fn) {
    const c = await pool.connect();
    try { await c.query('begin'); await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || {})]); const r = await fn(c); await c.query('commit'); return r; }
    catch (e) { await c.query('rollback').catch(() => { }); throw e; } finally { c.release(); }
  }
  const server = http.createServer(async (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); res.end(body == null ? '' : JSON.stringify(body)); };
    if (req.method === 'OPTIONS') return send(204);
    const url = new URL(req.url, 'http://x'); let raw = ''; for await (const ch of req) raw += ch; let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(400, { message: 'bad json' }); }
    const bearer = (req.headers.authorization || '').replace(/^Bearer /, ''); const claims = bearer ? verify(bearer) : null;
    if (req.headers.apikey !== 'test-anon-key') return send(401, { message: 'No API key found in request' });
    try {
      const P = url.pathname;
      if (P === '/auth/v1/signup') {
        const email = String(body.email || '').toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(400, { msg: 'Unable to validate email address' });
        if (String(body.password || '').length < 8) return send(422, { msg: 'Password should be at least 8 characters' });
        const ex = await pool.query('select id from auth.users where email = $1', [email]);
        if (!ex.rowCount) { const r = await pool.query('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [email, body.data || {}]); pw.set(r.rows[0].id, hash(body.password)); }
        outbox.push({ type: 'signup', email, redirect: url.searchParams.get('redirect_to') });
        return send(200, { id: crypto.randomUUID(), email, confirmation_sent_at: new Date().toISOString() }); // same shape whether or not the email existed
      }
      if (P === '/auth/v1/token') {
        const gt = url.searchParams.get('grant_type');
        if (gt === 'password') { const r = await pool.query('select id, email, email_confirmed_at from auth.users where email = $1', [String(body.email || '').toLowerCase()]); const u = r.rows[0];
          if (!u || !pw.has(u.id) || !check(String(body.password || ''), pw.get(u.id))) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
          if (!u.email_confirmed_at) return send(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
          await pool.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]); return send(200, session(u)); }
        if (gt === 'refresh_token') { const id = refresh.get(body.refresh_token); if (!id) return send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); refresh.delete(body.refresh_token); const r = await pool.query('select id, email from auth.users where id = $1', [id]); return send(200, session(r.rows[0])); }
        return send(400, { error: 'unsupported_grant_type' });
      }
      if (P === '/auth/v1/user') { if (!claims) return send(401, { msg: 'invalid JWT' }); if (req.method === 'PUT' && body.password) { if (String(body.password).length < 8) return send(422, { msg: 'Password should be at least 8 characters' }); pw.set(claims.sub, hash(body.password)); } return send(200, { id: claims.sub, email: claims.email }); }
      if (P === '/auth/v1/logout') return send(204);
      if (P === '/auth/v1/recover' || P === '/auth/v1/resend') { outbox.push({ type: P.endsWith('recover') ? 'recovery' : 'signup', email: String(body.email || '').toLowerCase(), redirect: url.searchParams.get('redirect_to') }); return send(200, {}); }
      const m = P.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (m && req.method === 'POST') {
        const keys = Object.keys(body); if (keys.some(k => !/^p_[a-z_]+$/.test(k))) return send(400, { message: 'bad args' });
        const sql = `select public.${m[1]}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
        const vals = keys.map(k => body[k] != null && typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]);
        const r = await asUser(claims ? { sub: claims.sub, role: 'authenticated' } : null, c => c.query(sql, vals)); return send(200, r.rows[0].r);
      }
      if (P === '/rest/v1/profiles' && req.method === 'PATCH') {
        if (!claims) return send(401, { message: 'JWT required' }); const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
        const cols = Object.keys(body).filter(k => ['display_name', 'hero', 'lang', 'public_profile'].includes(k)); if (!cols.length) return send(400, { message: 'nothing to update' });
        await asUser({ sub: claims.sub }, c => c.query(`update public.profiles set ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [id, ...cols.map(k => typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k])]));
        return send(204);
      }
      // ---- test-only helpers ----
      if (P === '/__test/confirm') { const email = url.searchParams.get('email'); const r = await pool.query('update auth.users set email_confirmed_at = now() where email = $1 returning id, email', [email]); if (!r.rowCount) return send(404, {}); const s = session(r.rows[0]); return send(200, { link: `${url.searchParams.get('redirect') || ''}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&type=${url.searchParams.get('type') || 'signup'}` }); }
      if (P === '/__test/outbox') return send(200, outbox);
      if (P === '/__test/sql') { const r = await pool.query(body.sql, body.params || []); return send(200, r.rows); }
      return send(404, { message: 'not found ' + P });
    } catch (e) { return send(e.code === '42501' ? 403 : 400, { message: e.message, code: e.code }); }
  });
  return new Promise(r => server.listen(port, () => r({ server, pool, outbox, close: async () => { server.close(); await pool.end(); } })));
};
