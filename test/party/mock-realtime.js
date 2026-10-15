// Local stand-in for Supabase Realtime (Phoenix v1 JSON over WebSocket): phx_join / broadcast (fan-out, not to self) /
// presence (track, presence_state, presence_diff joins+leaves on close) / heartbeat. Enough for engine/rtc.js.
const { WebSocketServer } = require('ws');
module.exports = function mockRealtime(port) {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  const topics = new Map(); // topic → Map(ws → {key, ref, meta})
  let n = 0; const ref = () => 'p' + (++n);
  const send = (ws, m) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } catch (e) { } };
  const stateOf = topic => { const out = {}; for (const [, s] of topics.get(topic) || []) if (s.meta) (out[s.key] = out[s.key] || { metas: [] }).metas.push(Object.assign({ phx_ref: s.ref }, s.meta)); return out; };
  wss.on('connection', (ws, req) => {
    if (!/apikey=/.test(req.url)) { ws.close(); return; }
    const mine = new Set();
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.topic === 'phoenix') return send(ws, { topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: m.ref });
      const subs = topics.get(m.topic) || new Map(); topics.set(m.topic, subs);
      if (m.event === 'phx_join') { subs.set(ws, { key: m.payload.config.presence.key, ref: ref(), meta: null }); mine.add(m.topic); send(ws, { topic: m.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: m.ref, join_ref: m.join_ref }); send(ws, { topic: m.topic, event: 'presence_state', payload: stateOf(m.topic) }); return; }
      const me = subs.get(ws); if (!me) return;
      if (m.event === 'broadcast') { for (const [o] of subs) if (o !== ws) send(o, { topic: m.topic, event: 'broadcast', payload: m.payload }); return; }
      if (m.event === 'presence' && m.payload.event === 'track') { me.meta = m.payload.payload; me.ref = ref(); const d = { joins: { [me.key]: { metas: [Object.assign({ phx_ref: me.ref }, me.meta)] } }, leaves: {} }; for (const [o] of subs) send(o, { topic: m.topic, event: 'presence_diff', payload: d }); return; }
      if (m.event === 'phx_leave') { leave(m.topic); mine.delete(m.topic); }
    });
    const leave = topic => { const subs = topics.get(topic); if (!subs) return; const me = subs.get(ws); subs.delete(ws); if (me && me.meta) { const d = { joins: {}, leaves: { [me.key]: { metas: [Object.assign({ phx_ref: me.ref }, me.meta)] } } }; for (const [o] of subs) send(o, { topic, event: 'presence_diff', payload: d }); } };
    ws.on('close', () => { for (const t of mine) leave(t); });
  });
  return { close: () => wss.close() };
};
