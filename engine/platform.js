// Inoa Games platform client: accounts (Supabase Auth over plain fetch), entitlement, the free-start gate, server-trusted
// round results, local-progress import, offline queue. Loaded lazily by the engine and by account/pricing/admin pages.
// Everything is OFF unless /platform.json has {"enabled": true}; then the server (RLS + RPC, see supabase/migrations) is the
// authority and this file only displays and forwards. Design: docs/PLATFORM_ARCHITECTURE.md.
const ROOT = new URL('../', import.meta.url);
const AUTH_KEY = 'inoa.auth', QUEUE_KEY = 'inoa.queue';
const S = { cfg: null, auth: null, status: null, listeners: new Set() };
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
const emit = () => S.listeners.forEach(f => { try { f(api.state()); } catch (e) { } });
export class PlatformError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

async function loadConfig() {
  if (S.cfg) return S.cfg;
  try { const r = await fetch(new URL('platform.json', ROOT), { cache: 'no-cache' }); S.cfg = r.ok ? await r.json() : { enabled: false }; } catch (e) { S.cfg = { enabled: false, offline: true }; }
  if (!S.cfg.supabaseUrl || !S.cfg.supabaseAnonKey) S.cfg.enabled = false;
  S.cfg.supabaseUrl = String(S.cfg.supabaseUrl || '').replace(/\/$/, '');
  return S.cfg;
}

/* ---------- low-level HTTP (Supabase Auth = GoTrue, data = PostgREST RPC) ---------- */
async function http(path, { method = 'POST', body, token, query = '' } = {}) {
  const c = S.cfg; const headers = { apikey: c.supabaseAnonKey, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res; try { res = await fetch(c.supabaseUrl + path + query, { method, headers, body: body == null ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new PlatformError('offline', 'No connection'); }
  const txt = await res.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { message: txt }; }
  if (!res.ok) { const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status); throw new PlatformError(res.status === 401 ? 'auth' : (data && data.code) || 'http_' + res.status, msg); }
  return data;
}
function saveAuth(d) {
  if (!d || !d.access_token) { S.auth = null; ls.set(AUTH_KEY, null); return; }
  S.auth = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)), user: { id: d.user.id, email: d.user.email } };
  ls.set(AUTH_KEY, S.auth);
}
async function token() {
  if (!S.auth) return null;
  if (S.auth.expires_at - 60 > Date.now() / 1000) return S.auth.access_token;
  try { saveAuth(await http('/auth/v1/token', { query: '?grant_type=refresh_token', body: { refresh_token: S.auth.refresh_token } })); }
  catch (e) { if (e.code === 'offline') return S.auth.access_token; saveAuth(null); emit(); return null; }
  return S.auth && S.auth.access_token;
}
async function rpc(fn, args = {}) { const t = await token(); if (!t) throw new PlatformError('auth', 'Please sign in'); return http('/rest/v1/rpc/' + fn, { body: args, token: t }); }

/* ---------- per-user caches (shared devices: nothing of player A stays visible after A signs out) ---------- */
const userKey = (k) => S.auth ? `${k}.u.${S.auth.user.id}` : null;
function cacheStatus(st) { S.status = st; if (S.auth) ls.set(userKey('inoa.status'), { st, at: Date.now() }); }
function cachedStatus(maxAgeMs) { if (!S.auth) return null; const c = ls.get(userKey('inoa.status'), null); return c && Date.now() - c.at < maxAgeMs ? c.st : null; }
function mirrorProfile(st) {
  // the engine/hub read the profile from localStorage; when signed in, the server's totals are mirrored into a per-user key
  if (!S.auth || !st) return; const k = 'inoa.profile.u.' + S.auth.user.id, p = ls.get(k, {});
  Object.assign(p, { v: 2, name: st.display_name, xp: st.xp, coins: st.coins, lang: st.lang, hero: st.hero && st.hero.model ? st.hero : p.hero, games: p.games || {}, recent: p.recent || [] });
  ls.set(k, p); ls.set('inoa.activeProfile', k);
}

/* ---------- public API ---------- */
const api = {
  PlatformError,
  async init() { await loadConfig(); S.auth = ls.get(AUTH_KEY, null); if (S.auth) ls.set('inoa.activeProfile', 'inoa.profile.u.' + S.auth.user.id); else ls.set('inoa.activeProfile', null); return api.state(); },
  get enabled() { return !!(S.cfg && S.cfg.enabled); },
  get config() { return S.cfg; },
  state() { return { enabled: api.enabled, signedIn: !!S.auth, user: S.auth && S.auth.user, status: S.status }; },
  onChange(f) { S.listeners.add(f); return () => S.listeners.delete(f); },

  async signUp(email, password, displayName, redirectTo) {
    const name = String(displayName || '').replace(/[<>]/g, '').trim().slice(0, 24);
    if (String(password || '').length < 8) throw new PlatformError('weak_password', 'Use at least 8 characters');
    const d = await http('/auth/v1/signup', { query: redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : '', body: { email, password, data: { display_name: name, app: 'inoa' } } });
    if (d && d.access_token) { saveAuth(d); emit(); } // only when the project does not require confirmation
    return { needsVerify: !(d && d.access_token) };
  },
  async signIn(email, password) {
    const prev = S.auth && S.auth.user.id;
    const d = await http('/auth/v1/token', { query: '?grant_type=password', body: { email, password } });
    if (prev && prev !== d.user.id) api._forgetUser(prev);
    saveAuth(d); ls.set('inoa.activeProfile', 'inoa.profile.u.' + d.user.id); await api.refreshStatus().catch(() => { }); emit(); return api.state();
  },
  async signOut() {
    const t = S.auth && S.auth.access_token, uid = S.auth && S.auth.user.id;
    if (t) http('/auth/v1/logout', { token: t }).catch(() => { });
    if (uid) api._forgetUser(uid);
    saveAuth(null); S.status = null; ls.set('inoa.activeProfile', null); emit();
  },
  _forgetUser(uid) { for (const k of ['inoa.status', 'inoa.profile']) ls.set(`${k}.u.${uid}`, null); try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('inoa.sess.')) sessionStorage.removeItem(k); } catch (e) { } ls.set(QUEUE_KEY, null); },
  async requestPasswordReset(email, redirectTo) { await http('/auth/v1/recover', { query: redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : '', body: { email } }); return true; }, // same answer whether or not the account exists
  async resendVerification(email, redirectTo) { await http('/auth/v1/resend', { query: redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : '', body: { type: 'signup', email } }); return true; },
  async updatePassword(password) { if (String(password || '').length < 8) throw new PlatformError('weak_password', 'Use at least 8 characters'); const t = await token(); if (!t) throw new PlatformError('auth'); await http('/auth/v1/user', { method: 'PUT', token: t, body: { password } }); return true; },
  // Email links land on account.html with #access_token=…&type=signup|recovery (or #error=…). Only same-origin pages read this.
  async handleRedirect() {
    const h = new URLSearchParams(location.hash.replace(/^#/, '')); if (!h.has('access_token') && !h.has('error')) return null;
    history.replaceState(null, '', location.pathname + location.search); // never keep tokens in the URL / history
    if (h.has('error')) return { type: 'error', error: h.get('error_description') || h.get('error') };
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token'), type = h.get('type') || 'signup';
    const user = await http('/auth/v1/user', { method: 'GET', token: access_token });
    saveAuth({ access_token, refresh_token, expires_in: +h.get('expires_in') || 3600, user }); await api.refreshStatus().catch(() => { }); emit();
    return { type };
  },
  async refreshStatus() { const st = await rpc('ig_my_status'); cacheStatus(st); mirrorProfile(st); emit(); return st; },
  async updateProfile(patch) {
    const t = await token(); if (!t) throw new PlatformError('auth'); const body = {};
    if (patch.display_name != null) body.display_name = String(patch.display_name).replace(/[<>]/g, '').trim().slice(0, 24);
    if (patch.hero != null) body.hero = patch.hero; if (patch.lang) body.lang = patch.lang === 'es' ? 'es' : 'en'; if (patch.public_profile != null) body.public_profile = !!patch.public_profile;
    await http('/rest/v1/ig_profiles', { method: 'PATCH', token: t, query: '?id=eq.' + S.auth.user.id, body }); return api.refreshStatus();
  },
  achievements() { return rpc('ig_my_achievements'); },
  async importLocal() {
    const p = ls.get('inoa.profile', null); if (!p || (!p.xp && !p.coins)) return { ok: false, reason: 'nothing' };
    const games = {}; for (const [k, v] of Object.entries(p.games || {})) games[k] = { plays: v.plays | 0, best: typeof v.best === 'number' ? v.best : null };
    const r = await rpc('ig_import_local_profile', { p_xp: p.xp | 0, p_coins: p.coins | 0, p_games: games }); await api.refreshStatus().catch(() => { }); return r;
  },

  // ---- the gate: one qualifying start per play session (server decides; see start_game) ----
  async startGame(gameId) {
    if (!api.enabled) return { allowed: true, local: true };
    if (!S.auth) return { allowed: false, reason: 'signin' };
    const sk = 'inoa.sess.' + gameId; let ck = null; try { ck = sessionStorage.getItem(sk); } catch (e) { }
    if (!ck) { ck = rid(); try { sessionStorage.setItem(sk, ck); } catch (e) { } }
    try {
      const r = await rpc('ig_start_game', { p_game: gameId, p_client_key: ck });
      if (r.allowed) { S.session = { gameId, id: r.session_id, expires: Date.parse(r.expires_at), access: r.access, ck }; api.refreshStatus().catch(() => { }); }
      return r;
    } catch (e) {
      if (e.code !== 'offline') return { allowed: false, reason: e.code === 'auth' ? 'signin' : 'error', message: e.message };
      // offline policy (docs §8): premium with a status cached < 72 h may play; free players may use starts left in the cache
      const st = cachedStatus(72 * 3600e3);
      if (!st) return { allowed: false, reason: 'offline' };
      if (st.plan === 'free') { const used = ls.get(userKey('inoa.offlineStarts'), { d: '', n: 0 }); const d = new Date().toISOString().slice(0, 10); const n = used.d === d ? used.n : 0; if (n >= (st.starts_left ?? 0)) return { allowed: false, reason: 'offline_limit' }; ls.set(userKey('inoa.offlineStarts'), { d, n: n + 1 }); }
      S.session = { gameId, id: null, offline: true, ck, expires: Date.now() + 30 * 60e3, access: st.plan };
      return { allowed: true, offline: true, access: st.plan };
    }
  },
  sessionValid(gameId) { return !api.enabled || (S.session && S.session.gameId === gameId && S.session.expires > Date.now()); },

  // ---- round results: the server clamps and de-duplicates; the returned totals are authoritative ----
  async finishRound(gameId, { score = null, bestLower = false, xp = 0, coins = 0 } = {}) {
    if (!api.enabled || !S.auth || !S.session || S.session.gameId !== gameId) return null;
    const item = { gameId, ck: S.session.ck, sid: S.session.id, roundKey: rid().slice(0, 16), score: Number.isFinite(+score) ? +score : null, bestLower: !!bestLower, xp: xp | 0, coins: coins | 0, at: Date.now() };
    if (!item.sid) { api._queue(item); return { queued: true }; }
    try { const r = await api._send(item); return r; } catch (e) { if (e.code === 'offline') { api._queue(item); return { queued: true }; } return { ok: false, reason: e.message }; }
  },
  async _send(item) {
    const r = await rpc('ig_finish_round', { p_session: item.sid, p_round_key: item.roundKey, p_score: item.score, p_best_lower: item.bestLower, p_xp: item.xp, p_coins: item.coins });
    if (r && r.ok) { const st = Object.assign({}, S.status || {}, { xp: r.xp_total, coins: r.coins_total, level: r.level }); cacheStatus(st); mirrorProfile(st); emit(); }
    return r;
  },
  _queue(item) { const q = ls.get(QUEUE_KEY, []); q.push(item); ls.set(QUEUE_KEY, q.slice(-50)); },
  pending() { return ls.get(QUEUE_KEY, []).length; },
  // Replays offline rounds when back online: a start is requested for the stored tab key (counted then), rounds older than 24 h are dropped.
  async flushQueue() {
    if (!api.enabled || !S.auth) return { sent: 0 }; const q = ls.get(QUEUE_KEY, []); if (!q.length) return { sent: 0 };
    let sent = 0, dropped = 0; const keep = [];
    for (const it of q) {
      if (Date.now() - it.at > 24 * 3600e3) { dropped++; continue; }
      try {
        if (!it.sid) { const r = await rpc('ig_start_game', { p_game: it.gameId, p_client_key: it.ck }); if (!r.allowed) { dropped++; continue; } it.sid = r.session_id; for (const o of q) if (o.ck === it.ck && !o.sid) o.sid = r.session_id; }
        const r = await api._send(it); if (r && (r.ok || r.duplicate)) sent++; else dropped++;
      } catch (e) { if (e.code === 'offline') { keep.push(it); } else dropped++; }
    }
    ls.set(QUEUE_KEY, keep); return { sent, dropped, left: keep.length };
  },
  rpc
};
export default api;
addEventListener('online', () => { if (api.enabled && S.auth) api.flushQueue().catch(() => { }); });
