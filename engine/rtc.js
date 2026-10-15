// Inoa Games — party transport: Supabase Realtime for signaling + relay, WebRTC data channels for the direct link.
// Drop-in for the small part of PeerJS that engine/net.js uses:
//   const p = new Peer(id?, opts); p.on('open'|'connection'|'error'|'disconnected', fn); p.connect(id, {metadata}) → conn;
//   p.reconnect(); p.destroy(); p.destroyed   ·   conn.on('open'|'data'|'close'|'error', fn); conn.send(obj); conn.close();
//   conn.open, conn.metadata, conn.peer, conn.relayed
// Why: phones can always reach the project's own Supabase (the same service accounts use), unlike a free public signaling
// server. A connection opens over the Realtime relay straight away, then upgrades to a direct WebRTC data channel when the
// network allows (same Wi-Fi: a few ms); if the direct link never forms, play continues over the relay.
// opts: { realtimeUrl: 'wss://<ref>.supabase.co/realtime/v1/websocket', apikey, config: { iceServers } }

const HEARTBEAT_MS = 25000, HELLO_RETRY_MS = 2000, HOST_WAIT_MS = 5000;
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter(f => f !== fn); return this; }
  _emit(ev, ...a) { for (const f of (this._h[ev] || []).slice()) { try { f(...a); } catch (e) { console.warn('rtc', ev, e); } } }
}
const err = (type, message) => Object.assign(new Error(message || type), { type });

/* ---------- minimal Supabase Realtime (Phoenix v1 JSON) socket with one channel ---------- */
class Channel extends Emitter {
  constructor(url, key, topic, presenceKey) {
    super(); this.url = url; this.key = key; this.topic = 'realtime:' + topic; this.pkey = presenceKey;
    this.ref = 0; this.joinRef = null; this.ws = null; this.joined = false; this.closed = false; this.queue = []; this.meta = null;
    this.presence = new Map();  // key → Set(phx_ref)
  }
  connect() {
    if (this.closed) return; const sep = this.url.includes('?') ? '&' : '?';
    let ws; try { ws = new WebSocket(this.url + sep + 'apikey=' + encodeURIComponent(this.key) + '&vsn=1.0.0'); } catch (e) { this._emit('error', err('network', e.message)); return; }
    this.ws = ws; this.joined = false;
    ws.onopen = () => {
      this.joinRef = String(++this.ref);
      this._raw({ topic: this.topic, event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false }, presence: { key: this.pkey }, private: false }, access_token: this.key.startsWith('eyJ') ? this.key : undefined }, ref: this.joinRef, join_ref: this.joinRef });
      clearInterval(this.hb); this.hb = setInterval(() => this._raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++this.ref) }), HEARTBEAT_MS);
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this._onMsg(m); };
    ws.onclose = () => { clearInterval(this.hb); const was = this.joined; this.joined = false; this.presence.clear(); if (this.closed) return; if (was) this._emit('down'); clearTimeout(this.rt); this.rt = setTimeout(() => this.connect(), 1500); };
    ws.onerror = () => { if (!this.joined) this._emit('error', err('network', 'Could not reach the party service')); };
  }
  _raw(m) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(m)); } catch (e) { } } }
  _onMsg(m) {
    if (m.topic !== this.topic) return;
    if (m.event === 'phx_reply' && m.ref === this.joinRef) {
      if (m.payload && m.payload.status === 'ok') { this.joined = true; if (this.meta) this._track(); const q = this.queue; this.queue = []; q.forEach(x => this.send(x)); this._emit('up'); }
      else this._emit('error', err('server-error', 'Party service refused the room (' + JSON.stringify(m.payload && m.payload.response || {}).slice(0, 80) + ')'));
      return;
    }
    if (m.event === 'broadcast' && m.payload && m.payload.event === 'm') return this._emit('msg', m.payload.payload || {});
    if (m.event === 'presence_state') { this.presence.clear(); for (const [k, v] of Object.entries(m.payload || {})) this.presence.set(k, new Set((v.metas || []).map(x => x.phx_ref))); return this._emit('presence'); }
    if (m.event === 'presence_diff') {
      const { joins = {}, leaves = {} } = m.payload || {};
      for (const [k, v] of Object.entries(joins)) { const s = this.presence.get(k) || new Set(); (v.metas || []).forEach(x => s.add(x.phx_ref)); this.presence.set(k, s); }
      for (const [k, v] of Object.entries(leaves)) { const s = this.presence.get(k); if (!s) continue; (v.metas || []).forEach(x => s.delete(x.phx_ref)); if (!s.size) { this.presence.delete(k); this._emit('left', k); } }
      return this._emit('presence');
    }
    if (m.event === 'phx_error' || m.event === 'phx_close') { if (!this.closed) { try { this.ws.close(); } catch (e) { } } }
  }
  has(key) { return this.presence.has(key); }
  track(meta) { this.meta = meta; if (this.joined) this._track(); }
  _track() { this._raw({ topic: this.topic, event: 'presence', payload: { type: 'presence', event: 'track', payload: this.meta }, ref: String(++this.ref), join_ref: this.joinRef }); }
  send(data) { if (!this.joined) { if (this.queue.length < 200) this.queue.push(data); return; } this._raw({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'm', payload: data }, ref: String(++this.ref), join_ref: this.joinRef }); }
  close() { this.closed = true; clearInterval(this.hb); clearTimeout(this.rt); try { this._raw({ topic: this.topic, event: 'phx_leave', payload: {}, ref: String(++this.ref), join_ref: this.joinRef }); } catch (e) { } try { this.ws && this.ws.close(); } catch (e) { } }
}

/* ---------- a connection: relay first, then a direct WebRTC data channel ---------- */
class Conn extends Emitter {
  constructor(peer, remoteId, metadata, initiator) {
    super(); this.peer = remoteId; this.metadata = metadata || {}; this.open = false; this._p = peer; this._init = initiator;
    this.pc = null; this.dc = null; this._ice = [];
  }
  get relayed() { return !(this.dc && this.dc.readyState === 'open'); }
  send(obj) {
    if (!this.open) return;
    if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(JSON.stringify(obj)); return; } catch (e) { } }
    this._p._sig({ t: 'd', to: this.peer, d: obj });
  }
  close() { if (this._closed) return; this._p._sig({ t: 'bye', to: this.peer }); this._end(); }
  _end() { if (this._closed) return; this._closed = true; const was = this.open; this.open = false; try { this.dc && this.dc.close(); } catch (e) { } try { this.pc && this.pc.close(); } catch (e) { } this._p._conns.delete(this.peer); if (was) this._emit('close'); else this._emit('error', err('closed')); }
  _opened() { if (this.open || this._closed) return; this.open = true; this._emit('open'); const q = this._early || []; this._early = null; q.forEach(d => this._emit('data', d)); }
  _data(d) { if (this.open) this._emit('data', d); else if (!this._closed) (this._early = this._early || []).push(d); }
  // direct link (best effort; the relay keeps working if it never forms)
  _pc() {
    if (this.pc || typeof RTCPeerConnection === 'undefined') return this.pc;
    const pc = this.pc = new RTCPeerConnection({ iceServers: (this._p.opts.config && this._p.opts.config.iceServers) || [] });
    pc.onicecandidate = e => { if (e.candidate) this._p._sig({ t: 'ice', to: this.peer, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ondatachannel = e => this._dc(e.channel);
    return pc;
  }
  _dc(ch) { this.dc = ch; ch.onmessage = e => { let d; try { d = JSON.parse(e.data); } catch (x) { return; } this._data(d); }; ch.onclose = () => { if (this.dc === ch) this.dc = null; }; }
  async _startDirect() { try { const pc = this._pc(); if (!pc) return; this._dc(pc.createDataChannel('inoa', { ordered: true })); const o = await pc.createOffer(); await pc.setLocalDescription(o); this._p._sig({ t: 'offer', to: this.peer, sdp: pc.localDescription }); } catch (e) { } }
  async _onOffer(sdp) { try { const pc = this._pc(); if (!pc) return; await pc.setRemoteDescription(sdp); await this._flushIce(); const a = await pc.createAnswer(); await pc.setLocalDescription(a); this._p._sig({ t: 'answer', to: this.peer, sdp: pc.localDescription }); } catch (e) { } }
  async _onAnswer(sdp) { try { if (this.pc) { await this.pc.setRemoteDescription(sdp); await this._flushIce(); } } catch (e) { } }
  async _onIce(c) { if (!this.pc || !this.pc.remoteDescription) { this._ice.push(c); return; } try { await this.pc.addIceCandidate(c); } catch (e) { } }
  async _flushIce() { const q = this._ice; this._ice = []; for (const c of q) { try { await this.pc.addIceCandidate(c); } catch (e) { } } }
}

/* ---------- Peer ---------- */
export class Peer extends Emitter {
  constructor(id, opts) {
    super(); if (typeof id === 'object') { opts = id; id = null; }
    this.opts = opts || {}; this.id = id || 'c-' + rid(); this.isHost = !!id; this.destroyed = false; this._conns = new Map(); this._wanted = new Map(); this._chans = new Map();
    if (!this.opts.realtimeUrl || !this.opts.apikey) { setTimeout(() => this._emit('error', err('server-error', 'Party service is not configured')), 0); return; }
    if (this.isHost) { const ch = this._chan(this.id); ch.track({ role: 'host', at: Date.now() }); ch.on('up', () => this._emit('open', this.id)); ch.connect(); }
    else setTimeout(() => this._emit('open', this.id), 0);  // clients open their room channel on connect()
  }
  _chan(room) {
    let ch = this._chans.get(room); if (ch) return ch;
    ch = new Channel(this.opts.realtimeUrl, this.opts.apikey, room, this.id); this._chans.set(room, ch);
    ch.on('msg', m => this._onSig(room, m));
    ch.on('error', e => this._emit('error', e));
    ch.on('down', () => { if (!this.isHost) for (const c of [...this._conns.values()]) if (c._room === room) c._end(); this._emit('disconnected'); });
    ch.on('left', k => { const c = this._conns.get(k); if (c) c._end(); });
    return ch;
  }
  _sig(m) { const c = this._conns.get(m.to) || this._wanted.get(m.to); const room = this.isHost ? this.id : (c && c._room); const ch = room && this._chans.get(room); if (ch) ch.send(Object.assign({ from: this.id }, m)); }
  _onSig(room, m) {
    if (!m || m.to !== this.id || !m.from) return;
    let c = this._conns.get(m.from) || this._wanted.get(m.from);
    if (this.isHost && m.t === 'hello') {
      if (c) { if (Date.now() - c._at < 1500) return; c._end(); }   // a fresh hello from a known phone = it reconnected: start over
      c = new Conn(this, m.from, m.meta, false); c._room = this.id; c._at = Date.now(); this._conns.set(m.from, c);
      this._emit('connection', c);
      // 'accept' must reach the phone before anything the 'open' handlers send (welcome / waiting-for-approval)
      setTimeout(() => { this._sig({ t: 'accept', to: m.from }); c._opened(); c._startDirect(); }, 0);
      return;
    }
    if (!c) return;
    if (m.t === 'accept') { if (this._wanted.get(m.from) === c) { this._wanted.delete(m.from); this._conns.set(m.from, c); clearInterval(c._hello); clearTimeout(c._miss); c._opened(); } return; }
    if (m.t === 'd') return c._data(m.d);
    if (m.t === 'offer') return c._onOffer(m.sdp);
    if (m.t === 'answer') return c._onAnswer(m.sdp);
    if (m.t === 'ice') return c._onIce(m.c);
    if (m.t === 'bye') return c._end();
  }
  connect(id, { metadata } = {}) {
    const c = new Conn(this, id, metadata, true); c._room = id; this._wanted.set(id, c);
    const ch = this._chan(id); ch.track({ role: 'guest', at: Date.now() });
    const hello = () => { if (!c.open && !c._closed) ch.send({ t: 'hello', from: this.id, to: id, meta: metadata || {} }); };
    const start = () => {
      hello(); clearInterval(c._hello); c._hello = setInterval(hello, HELLO_RETRY_MS);
      // no host in the room → like PeerJS 'peer-unavailable'
      clearTimeout(c._miss); c._miss = setTimeout(() => { if (!c.open && !c._closed && !ch.has(id)) { clearInterval(c._hello); this._wanted.delete(id); c._closed = true; c._emit('error', err('peer-unavailable', 'Room not found')); this._emit('error', err('peer-unavailable', 'Could not connect to peer ' + id)); } }, HOST_WAIT_MS);
    };
    if (ch.joined) start(); else { ch.on('up', function once() { ch.off('up', once); start(); }); if (!ch.ws) ch.connect(); }
    return c;
  }
  reconnect() { for (const ch of this._chans.values()) if (!ch.joined && !ch.closed && (!ch.ws || ch.ws.readyState > 1)) ch.connect(); }
  destroy() { if (this.destroyed) return; this.destroyed = true; for (const c of [...this._conns.values()]) { try { c.close(); } catch (e) { } } for (const c of this._wanted.values()) { clearInterval(c._hello); clearTimeout(c._miss); } for (const ch of this._chans.values()) ch.close(); this._chans.clear(); }
}
