// Inoa Games networking — party rooms: Supabase Realtime (signaling + relay) + WebRTC data channels (engine/rtc.js).
// One device HOSTS a room (TV/laptop running a game). Phones JOIN as controllers ("pad")
// or as online players with their own screen ("player"). Room code = 4 letters.
// The host keeps the same room across page loads (hub -> game -> hub): the code lives in
// sessionStorage and the host re-claims the same peer id; pads auto-reconnect.
//
// Signaling: the project's Supabase Realtime (URL + public key from /platform.json). Override for tests with
// window.INOA_NET = {realtimeUrl, apikey, config:{iceServers}} or localStorage 'inoa.net'.
import { Peer } from './rtc.js';
const QRJS = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const PREFIX = 'inoa-v1-';
const COLORS = ['#ff6b6b', '#5bb8ff', '#ffd166', '#2fbf8a', '#c9b8ff', '#ff9a3c', '#ff8ad8', '#8be0ff'];
const NAMES = ['Coral', 'Sky', 'Sun', 'Mint', 'Lilac', 'Mango', 'Rose', 'Ice'];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

const scripts = {};
function loadScript(src, globalName) { if (window[globalName]) return Promise.resolve(window[globalName]); if (!scripts[src]) scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(window[globalName]); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); return scripts[src]; }
let _plat = null;
async function platformCfg() {
  if (_plat) return _plat;
  try { const r = await fetch(new URL('../platform.json', import.meta.url), { cache: 'no-cache' }); const j = r.ok ? await r.json() : {}; _plat = j; } catch (e) { _plat = {}; }
  return _plat;
}
async function rtcOpts() {
  const c = cfg(); if (c.realtimeUrl) return c;
  const p = await platformCfg(); const base = String(p.supabaseUrl || '').replace(/\/$/, '');
  return Object.assign({}, c, { realtimeUrl: base ? base.replace(/^http/, 'ws') + '/realtime/v1/websocket' : '', apikey: p.realtimeKey || p.supabaseAnonKey || '' });
}
function cfg() { let o = window.INOA_NET; if (!o) { try { o = JSON.parse(localStorage.getItem('inoa.net') || 'null'); } catch (e) { } } return Object.assign({ debug: 0, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // TURN relay (PeerJS's free default servers): needed when the phone and the screen can't reach each other directly —
  // phone on mobile data, Wi-Fi that isolates devices (guest/mesh/school networks), strict NAT. Without it joining fails.
  // For launch, add a dedicated TURN service via window.INOA_NET / localStorage['inoa.net'] (see docs/MULTIPLAYER.md).
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }], sdpSemantics: 'unified-plan' } }, o || {}); }
function ss(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function clientId() { try { let id = localStorage.getItem('inoa.cid'); if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('inoa.cid', id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); } }
export function makeCode() { let c = ''; for (let i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; }
const blankInput = () => ({ x: 0, y: 0, a: false, b: false, c: false, d: false, pause: false });

/* ---------------- event emitter ---------------- */
const handlers = {};
function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return () => off(ev, fn); }
function off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); }
function emit(ev, ...a) { for (const f of (handlers[ev] || [])) { try { f(...a); } catch (e) { console.warn('net handler', ev, e); } } }

/* ---------------- shared state ---------------- */
export const net = {
  role: null,          // 'host' | 'client' | null
  code: null,
  status: 'off',       // off | connecting | ready | error
  error: null,
  players: [],         // host side: [{slot, id, kind, name, color, connected, input}]
  me: null,            // client side: {slot, color, name}
  layout: { type: 'gamepad' },
  online: null,        // {page, label}: game page friends can open to play on their own screen
  on, off,
  get joinUrl() { return this.code ? new URL('pad.html?r=' + this.code, location.href.replace(/games\/[^/]*$/, '').replace(/[^/]*$/, '')).href : ''; },
  pads(kind) { return this.players.filter(p => p.connected && (!kind || p.kind === kind)); },
  // 'direct' (WebRTC, lowest lag) or 'relay' (through Supabase Realtime) for this phone's link; host: 'direct' if any phone is direct
  get link() { const cs = this.role === 'client' ? [clientConn] : [...hostConns.values()]; const live = cs.filter(c => c && c.open); if (!live.length) return null; return live.some(c => !c.relayed) ? 'direct' : 'relay'; },
  // Live input of a slot ({x,y,a,b,c,d,pause}); zeroed if the phone went quiet (>1.5 s, it heartbeats every 200 ms).
  pad(slot) { const p = this.players.find(p => p.slot === slot && p.connected); if (!p) return null; if (p.input.at && performance.now() - p.input.at > 1500) return blankInput(); return p.input; },
  // Online-capable page for players with their own screen (e.g. games/drift.html?join=CODE)
  onlineUrl(page) { return this.code ? new URL(page + (page.includes('?') ? '&' : '?') + 'join=' + this.code, location.href.replace(/games\/[^/]*$/, '').replace(/[^/]*$/, '')).href : ''; }
};
let peer = null, hostConns = new Map(), clientConn = null, retryTimer = 0, sendTimer = 0, lastSent = '';

/* ---------------- host ---------------- */
async function openPeer(id) {
  const c = await rtcOpts();
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, c) : new Peer(c); let done = false;
    p.on('open', () => { done = true; resolve(p); });
    p.on('error', e => { if (!done) { done = true; try { p.destroy(); } catch (x) { } reject(e); } else handlePeerError(e); });
    setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (x) { } reject(new Error('Signaling timeout')); } }, 12000);
  });
}
function handlePeerError(e) { net.error = e && (e.type || e.message); emit('error', net.error); if (e && e.type === 'disconnected') try { peer.reconnect(); } catch (x) { } }

export async function host(code) {
  if (net.role === 'host' && peer && !peer.destroyed) return net.code;
  net.role = 'host'; net.code = code || ss('inoa.room')?.code || makeCode(); net.status = 'connecting'; emit('status', net.status);
  const saved = ss('inoa.room'); if (saved && saved.code === net.code && saved.players) net.players = saved.players.map(p => ({ ...p, connected: false, input: blankInput() }));
  ss('inoa.room', { code: net.code, role: 'host', players: net.players.map(({ slot, id, kind, name, color }) => ({ slot, id, kind, name, color })) });
  // Claim the room id on the signaling server. After a page change the server can still hold the previous page's claim for a
  // while ('unavailable-id'); network hiccups also happen. Keep trying for ~30 s; if the old code stays stuck, switch to a fresh
  // code (phones will need the new one). The code is only shown to players once status is 'ready'.
  const t0 = Date.now(); let switched = false;
  for (;;) {
    try { peer = await openPeer(PREFIX + net.code); break; }
    catch (e) {
      const type = e && (e.type || e.message); net.error = type;
      if (type === 'unavailable-id' && !switched && Date.now() - t0 > 15000 && !code) { switched = true; net.code = makeCode(); ss('inoa.room', { code: net.code, role: 'host', players: [] }); net.players = []; emit('change'); }
      if (Date.now() - t0 < 30000) { await new Promise(r => setTimeout(r, 1200)); continue; }
      net.status = 'error'; emit('status', net.status); emit('change'); throw e;
    }
  }
  peer.on('connection', conn => acceptConn(conn));
  // lost the signaling server (sleep, network change): new phones can't find the room until we're back, so say so and reconnect
  peer.on('disconnected', () => { net.status = 'reconnecting'; emit('status', net.status); try { peer.reconnect(); } catch (e) { } });
  peer.on('open', () => { if (net.status !== 'ready') { net.status = 'ready'; emit('status', net.status); emit('change'); } });
  net.status = 'ready'; emit('status', net.status); emit('change');
  addEventListener('pagehide', () => { try { for (const c of hostConns.values()) c.send({ t: 'bye', reason: 'nav' }); peer.destroy(); } catch (e) { } });
  return net.code;
}
// Host approval ("no strangers"): a phone that is new to this room must be let in on the big screen. Phones already in the
// room (same device id, e.g. reconnecting after the host switched games) rejoin silently. Tests can set INOA_NET.autoApprove.
const _L = (en, es) => (document.documentElement.lang === 'es' ? es : en);
const _esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let _approvals = Promise.resolve();
function askApproval(name, kind) {
  if (cfg().autoApprove) return Promise.resolve(true);
  const run = () => new Promise(res => {
    if (!document.getElementById('inoa-approve-css')) { const st = document.createElement('style'); st.id = 'inoa-approve-css'; st.textContent = '.inoa-approve{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:10000;background:#fffaf0;color:#132a36;border-radius:20px;padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:grid;gap:10px;width:min(380px,calc(100vw - 24px));font:600 16px system-ui,sans-serif}.inoa-approve b{font-size:18px}.inoa-approve div{display:flex;gap:8px;justify-content:flex-end}.inoa-approve button{font:inherit;font-weight:800;min-height:46px;padding:0 18px;border-radius:14px;border:2px solid rgba(19,42,54,.25);background:#fff;cursor:pointer}.inoa-approve button.ok{background:#2de2c3;border-color:#2de2c3}'; document.head.appendChild(st); }
    const d = document.createElement('div'); d.className = 'inoa-approve'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
    d.innerHTML = `<b>📱 ${_esc(name)} ${_L(kind === 'player' ? 'wants to join online' : 'wants to join', kind === 'player' ? 'quiere unirse en línea' : 'quiere unirse')}</b><span>${_L('Only let in people you know.', 'Deja entrar solo a personas que conoces.')}</span><div><button data-v="0">${_L('Deny', 'No')}</button><button class="ok" data-v="1">${_L('Allow', 'Permitir')}</button></div>`;
    document.body.appendChild(d); let done = false;
    const finish = v => { if (done) return; done = true; clearTimeout(to); d.remove(); res(v); };
    d.querySelectorAll('button').forEach(b => b.onclick = () => finish(b.dataset.v === '1'));
    const to = setTimeout(() => finish(false), 60000);
    setTimeout(() => d.querySelector('.ok')?.focus({ preventScroll: true }), 30);
  });
  const p = _approvals.then(run); _approvals = p.catch(() => false); return p;
}
function acceptConn(conn) {
  const meta = conn.metadata || {}; const id = meta.id || conn.peer;
  conn.on('open', async () => {
    let p = net.players.find(x => x.id === id);
    if (!p) { try { conn.send({ t: 'wait' }); } catch (e) { } const ok = await askApproval(String(meta.name || _L('A phone', 'Un teléfono')).slice(0, 14), meta.kind); if (!ok || !conn.open) { try { conn.send({ t: 'denied' }); } catch (e) { } setTimeout(() => { try { conn.close(); } catch (e) { } }, 300); return; } p = net.players.find(x => x.id === id); }
    if (!p) { const used = new Set(net.players.map(x => x.slot)); let slot = 1; while (used.has(slot)) slot++; if (slot > 8) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; } p = { slot, id, kind: meta.kind || 'pad', name: (meta.name || NAMES[slot - 1]).slice(0, 14), color: COLORS[slot - 1], connected: true, input: blankInput() }; net.players.push(p); net.players.sort((a, b) => a.slot - b.slot); }
    p.connected = true; p.kind = meta.kind || p.kind; if (meta.name) p.name = String(meta.name).slice(0, 14); p.input = blankInput(); hostConns.set(id, conn);
    conn.send({ t: 'welcome', slot: p.slot, color: p.color, name: p.name, game: document.title, layout: net.layout, online: net.online });
    persist(); emit('join', p); emit('change');
  });
  conn.on('data', m => { const p = net.players.find(x => x.id === id); if (!p || !m) return; if (m.t === 'in') { const was = p.input.pause; Object.assign(p.input, m.s); p.input.at = performance.now(); if (m.s.pause && !was) padPause(); emit('input', p); } else if (m.t === 'name') { p.name = String(m.name || '').slice(0, 14); persist(); emit('change'); } else emit('msg', p, m); });
  const gone = () => { const p = net.players.find(x => x.id === id); if (p && hostConns.get(id) === conn) { p.connected = false; p.input = blankInput(); hostConns.delete(id); emit('leave', p); emit('change'); } };
  conn.on('close', gone); conn.on('error', gone);
}
// A phone's ⏸ acts like pressing Escape on the host (every game listens for it).
function padPause() { try { const o = { code: 'Escape', key: 'Escape', bubbles: true }; dispatchEvent(new KeyboardEvent('keydown', o)); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', o)), 60); } catch (e) { } }
function persist() { const s = ss('inoa.room'); if (s) { s.players = net.players.map(({ slot, id, kind, name, color }) => ({ slot, id, kind, name, color })); ss('inoa.room', s); } }
export function broadcast(msg, kind) { for (const [id, c] of hostConns) { if (kind && (net.players.find(p => p.id === id) || {}).kind !== kind) continue; try { c.send(msg); } catch (e) { } } }
export function send(slot, msg) { const p = net.players.find(x => x.slot === slot); const c = p && hostConns.get(p.id); if (c) try { c.send(msg); } catch (e) { } }
export function setLayout(layout, slot) { if (slot == null) { net.layout = layout; broadcast({ t: 'layout', layout }); } else send(slot, { t: 'layout', layout }); }
// Advertise an own-screen online mode for this game (phones show a 'Play on this screen' button).
export function setOnline(info) { net.online = info || null; broadcast({ t: 'online', online: net.online }); }
export function rumble(slot, ms = 40) { if (slot == null) broadcast({ t: 'rumble', ms }); else send(slot, { t: 'rumble', ms }); }
export function endParty() { broadcast({ t: 'bye', reason: 'end' }); ss('inoa.room', null); try { peer && peer.destroy(); } catch (e) { } peer = null; hostConns.clear(); net.players = []; net.role = null; net.code = null; net.status = 'off'; emit('status', 'off'); emit('change'); }
// Re-host automatically if this tab hosted a party on a previous page.
export function resume() { const s = ss('inoa.room'); if (new URLSearchParams(location.search).has('join')) return Promise.resolve(null); if (s && s.role === 'host' && net.role !== 'host') return host(s.code).catch(e => console.warn('party resume failed', e)); return Promise.resolve(net.code); }

/* ---------------- client (phone pad / online player) ---------------- */
export async function join(code, { kind = 'pad', name = '' } = {}) {
  code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (code.length !== 4) throw new Error('Enter the 4-letter code');
  net.role = 'client'; net.code = code; net.status = 'connecting'; emit('status', net.status); let denied = false; // a host that said no is never re-asked
  if (!peer || peer.destroyed) peer = await openPeer();
  const connect = () => new Promise((resolve, reject) => {
    const conn = peer.connect(PREFIX + code, { reliable: true, metadata: { kind, name, id: clientId() } }); let opened = false;
    // no host with that code → PeerJS reports 'peer-unavailable' on the peer right away: fail fast instead of waiting for the timeout
    const onPeerErr = e => { if (e && e.type === 'peer-unavailable' && !opened) { try { peer.off('error', onPeerErr); } catch (x) { } reject(new Error('Room not found')); } }; try { peer.on('error', onPeerErr); } catch (x) { }
    conn.on('open', () => { opened = true; clientConn = conn; try { peer.off('error', onPeerErr); } catch (x) { } });
    conn.on('data', m => { if (!m) return; if (m.t === 'wait') { net.status = 'waiting'; emit('status', 'waiting'); } else if (m.t === 'denied') { denied = true; clearTimeout(retryTimer); net.status = 'ended'; emit('status', 'denied'); reject(new Error('Not allowed in')); } else if (m.t === 'welcome') { net.me = { slot: m.slot, color: m.color, name: m.name }; net.layout = m.layout || net.layout; net.online = m.online || null; net.status = 'ready'; emit('status', 'ready'); emit('welcome', m); emit('layout', net.layout); emit('online', net.online); resolve(conn); } else if (m.t === 'online') { net.online = m.online || null; emit('online', net.online); } else if (m.t === 'layout') { net.layout = m.layout; emit('layout', m.layout); } else if (m.t === 'rumble') { try { navigator.vibrate && navigator.vibrate(m.ms); } catch (e) { } } else if (m.t === 'full') { net.status = 'error'; net.error = 'Room is full'; emit('status', 'error'); } else if (m.t === 'bye' && m.reason === 'end') { net.status = 'ended'; emit('status', 'ended'); } else emit('msg', m); });
    conn.on('close', () => { if (clientConn === conn) clientConn = null; if (net.status !== 'ended' && !denied) { net.status = 'reconnecting'; emit('status', 'reconnecting'); scheduleReconnect(); } });
    conn.on('error', () => { if (!opened) reject(new Error('Could not reach the room')); });
    setTimeout(() => { if (!net.me || clientConn !== conn) { if (!opened) { try { conn.close(); } catch (e) { } reject(new Error('Room not found')); } } }, 15000);
  });
  let tries = 0; const scheduleReconnect = () => { clearTimeout(retryTimer); if (denied) return; if (tries++ > 90) { net.status = 'error'; net.error = 'Lost the room'; emit('status', 'error'); return; } retryTimer = setTimeout(() => connect().then(() => { tries = 0; }).catch(scheduleReconnect), 1200); };
  const deadline = Date.now() + 25000;
  for (;;) {
    try { await connect(); break; }
    catch (e) {
      if (!denied && e.message === 'Room not found' && Date.now() < deadline) { net.status = 'looking'; emit('status', 'looking'); await new Promise(r => setTimeout(r, 2500)); continue; }
      net.status = 'error'; net.error = e.message; emit('status', 'error'); throw e;
    }
  }
  return net.me;
}
// Throttled input sender for pads: call every frame or on change.
// Phone input: buttons go out immediately; stick-only changes are quantized (0.05) and capped at one message per 25 ms
// (40 Hz) with a trailing send, so a 120 Hz touchscreen can't flood the ordered/reliable data channel and build up lag.
let lastIn = null, stickTimer = 0;
const q = v => Math.round((+v || 0) * 20) / 20;
export function sendInput(state) {
  const st = Object.assign({}, state, { x: q(state.x), y: q(state.y) }), s = JSON.stringify(st), now = performance.now();
  if (s === lastSent && now - sendTimer < 250) return;   // unchanged: only the heartbeat goes out
  const stickOnly = lastIn && ['a', 'b', 'c', 'd', 'pause'].every(k => !!lastIn[k] === !!st[k]);
  const gap = clientConn && clientConn.relayed ? 60 : 25;   // relay (through Supabase): ~16 Hz stick updates keep within the free plan's message rate
  if (stickOnly && now - sendTimer < gap) { clearTimeout(stickTimer); stickTimer = setTimeout(() => sendInput(st), gap - (now - sendTimer)); return; }
  clearTimeout(stickTimer); lastSent = s; lastIn = st; sendTimer = now;
  if (clientConn && clientConn.open) try { clientConn.send({ t: 'in', s: st }); } catch (e) { }
}
export function sendMsg(msg) { if (net.role === 'client') { if (clientConn && clientConn.open) try { clientConn.send(msg); } catch (e) { } } else broadcast(msg); }

/* ---------------- QR + party widget ---------------- */
export async function qrSvg(text, { dark = '#1b2430', light = '#ffffff', margin = 2 } = {}) { const qrcode = await loadScript(QRJS, 'qrcode'); const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), m = margin; let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`; }

const WCSS = `@media (max-width:760px){.inoa-party{display:none}}
.inoa-party{position:fixed;right:62px;top:max(10px,env(safe-area-inset-top));z-index:21;font-family:Manrope,system-ui,sans-serif}
.inoa-party>button{display:flex;align-items:center;gap:6px;border:0;border-radius:16px;padding:9px 12px;background:rgba(255,248,238,.94);color:#1b2430;font-weight:800;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer}
.inoa-party .dots{display:flex;gap:3px}.inoa-party .dots i{width:10px;height:10px;border-radius:50%;display:block;border:2px solid #1b2430}
.inoa-pp{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(13,27,38,.5);backdrop-filter:blur(6px);padding:16px;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif}
.inoa-pp .card{background:#fff8ee;color:#1b2430;border-radius:26px;padding:22px;width:min(460px,100%);display:grid;gap:12px;box-shadow:0 24px 70px rgba(0,0,0,.35);max-height:92vh;overflow:auto;box-sizing:border-box}
.inoa-pp h2{margin:0;font-family:Unbounded,Manrope,sans-serif;font-size:22px}.inoa-pp p{margin:0;color:#4c5868;font-weight:600;line-height:1.45}
.inoa-pp .qr{width:min(220px,60vw);margin:0 auto;border-radius:14px;overflow:hidden;background:#fff;padding:8px}
.inoa-pp .code{font-family:Unbounded,monospace;font-weight:900;font-size:40px;letter-spacing:.2em;text-align:center}
.inoa-pp .url{font-size:12px;text-align:center;word-break:break-all;color:#4c5868}
.inoa-pp .list{display:grid;gap:6px}.inoa-pp .pl{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid rgba(27,36,48,.1);border-radius:12px;padding:8px 10px;font-weight:800}
.inoa-pp .pl i{width:14px;height:14px;border-radius:50%;display:block}.inoa-pp .pl small{margin-left:auto;color:#4c5868;font-weight:700}
.inoa-pp .row{display:flex;gap:8px;flex-wrap:wrap}.inoa-pp .row button{flex:1;min-height:48px;border-radius:14px;border:0;font-weight:900;cursor:pointer;font-family:Unbounded,Manrope,sans-serif}
.inoa-pp .go{background:#0f5c48;color:#fff}.inoa-pp .ghost{background:#fff;color:#1b2430;box-shadow:inset 0 0 0 2px rgba(27,36,48,.12)}
.inoa-pp .online{display:grid;gap:8px;border-top:2px dashed rgba(27,36,48,.12);padding-top:12px}.inoa-pp .st{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#0f5c48}`;
function css() { if (document.getElementById('inoaPartyCss')) return; const s = document.createElement('style'); s.id = 'inoaPartyCss'; s.textContent = WCSS; document.head.appendChild(s); }
// Floating "📱 phones" chip for game pages; opens the party panel.
export function partyWidget({ hint = 'Phones join as controllers. Player 1 = first phone.', online = null } = {}) {
  if (net.role === 'client' || new URLSearchParams(location.search).has('join')) return null;
  css(); const w = document.createElement('div'); w.className = 'inoa-party'; w.innerHTML = '<button aria-label="Phone controllers">📱 <span class="lbl">Phones</span><span class="dots"></span></button>'; document.body.appendChild(w);
  const render = () => { const pads = net.pads(); w.querySelector('.lbl').textContent = net.status === 'ready' ? (pads.length ? pads.length : 'Add') : net.status === 'connecting' ? '…' : 'Phones'; w.querySelector('.dots').innerHTML = pads.map(p => `<i style="background:${p.color}"></i>`).join(''); };
  on('change', render); on('status', render); render();
  w.querySelector('button').onclick = () => partyPanel({ hint, online });
  return w;
}
export async function partyPanel({ hint = '', online = null } = {}) {
  if (net.role === 'client') return null;
  css(); const d = document.createElement('div'); d.className = 'inoa-pp'; d.innerHTML = '<div class="card"><div class="st">Party room</div><h2>Scan to play</h2><p>Opening a room…</p></div>'; document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d) d.remove(); });
  try { await host(); } catch (e) { d.querySelector('.card').innerHTML = `<div class="st">Party room</div><h2>Couldn't open a room</h2><p>The connection service didn't answer (${net.error || e.message}). Check the internet connection and try again.</p><div class="row"><button class="ghost" data-x>Close</button><button class="go" data-r>Try again</button></div>`; d.querySelector('[data-x]').onclick = () => d.remove(); d.querySelector('[data-r]').onclick = () => { d.remove(); net.role = null; partyPanel({ hint }); }; return d; }
  const svg = await qrSvg(net.joinUrl).catch(() => '');
  const render = () => { if (!d.isConnected) return; const card = d.querySelector('.card'); card.innerHTML = `<div class="st">Party room · ${net.status === 'ready' ? '● online' : '○ reconnecting…'} · ${net.pads().length} connected</div><h2>Scan to play</h2><p>${hint || 'Point a phone camera at the code. The phone becomes a controller with vibration.'}</p><div class="qr">${svg}</div><div class="code">${net.code}</div><div class="url">or open <b>${net.joinUrl.replace(/^https?:\/\//, '').replace(/pad\.html\?r=.*/, 'pad.html')}</b> and type the code</div>${online ? `<div class="online"><div class="st">Online · from another home</div><p>${online.text || 'Friends far away can join on their own screen with this link:'}</p><div class="url"><b>${net.onlineUrl(online.page)}</b></div><div class="row"><button class="ghost" data-share>📣 Share link</button></div></div>` : ''}<div class="list">${net.players.map(p => `<div class="pl"><i style="background:${p.color}"></i>P${p.slot} · ${p.name}<small>${p.connected ? (p.kind === 'player' ? 'online' : 'phone') : 'reconnecting…'}</small></div>`).join('') || '<p>No phones yet.</p>'}</div><div class="row"><button class="ghost" data-end>End party</button><button class="go" data-x>Done</button></div>`; card.querySelector('[data-x]').onclick = () => d.remove(); card.querySelector('[data-end]').onclick = () => { endParty(); d.remove(); }; const sh = card.querySelector('[data-share]'); if (sh) sh.onclick = async () => { const url = net.onlineUrl(online.page); try { if (navigator.share) await navigator.share({ title: 'Join my Inoa Games room', text: `Join my room ${net.code} on Inoa Games!`, url }); else { await navigator.clipboard.writeText(url); sh.textContent = '✅ Link copied'; } } catch (e) { } }; };
  on('change', render); on('status', render); render(); return d;
}
export default net;
