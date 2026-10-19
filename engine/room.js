// Online rooms on separate screens (roadmap R7). Host-authoritative: the host's page runs the game, every guest's page
// sends only its input or its moves, and the host sends back what that guest may see. Built on engine/net.js party rooms
// (guests join as kind 'player' with games/<game>.html?join=CODE; every new device still needs Allow on the big screen).
//
// Messages are tagged with a per-game prefix: `${prefix}-start`, `${prefix}` (snapshots), `${prefix}-lobby`, and
// `${prefix}-<kind>` for anything else (e.g. Island Drift's 'dr-fin'). Real-time games stream snapshots with
// room.snapshot(dt, build); turn-based games send each guest its own view with room.send(slot, 'view', {...}).
//
// Host:  const room = hostRoom({ prefix: 'dr', online: { page, label }, rate: 20 });
//        room.players · room.input(slot) · room.start(data) · room.snapshot(dt, () => data) · room.send(slot, kind, data)
//        room.broadcast(kind, data) · room.lobby() · room.on(kind, (player, msg) => …) · room.onJoin / onLeave
// Guest: const room = guestRoom({ prefix: 'dr', code, L, game: 'Island Drift', help, on: { start, snap, lobby, <kind> } });
//        room.join() · room.sendInput(state) · room.act(kind, data) · room.wait(html) · room.close() · room.me
import * as NET from './net.js';

const net = NET.net;
const tag = (prefix, kind) => kind ? `${prefix}-${kind}` : prefix;
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const defL = (en, es) => (document.documentElement.lang || '').startsWith('es') ? es : en;

export function hostRoom({ prefix, online = null, rate = 20 } = {}) {
  const handlers = {}; let acc = 0; let live = true;
  const offs = [
    net.on('msg', (p, m) => { if (!live || !p || !m || p.kind !== 'player' || typeof m.t !== 'string') return; for (const f of handlers[m.t] || []) f(p, m); }),
    net.on('join', p => { if (live && p && p.kind === 'player') for (const f of handlers[':join'] || []) f(p); }),
    net.on('leave', p => { if (live && p && p.kind === 'player') for (const f of handlers[':leave'] || []) f(p); })
  ];
  // advertise the own-screen mode to every phone in the room (phones show a 'Play on this screen' button)
  if (online) { const adv = () => { if (live && net.role === 'host' && net.status === 'ready') NET.setOnline(online); }; offs.push(net.on('status', adv)); adv(); }
  const room = {
    prefix,
    get players() { return net.role === 'host' ? net.pads('player') : []; },
    input(slot) { return net.pad(slot); },
    start(data = {}) { NET.broadcast({ t: tag(prefix, 'start'), ...data }, 'player'); acc = 0; },
    // call every frame: sends build() to every guest at `rate` Hz
    snapshot(dt, build) { acc -= dt; if (acc <= 0) { acc = 1 / rate; NET.broadcast({ t: prefix, ...build() }, 'player'); } },
    send(slot, kind, data = {}) { NET.send(slot, { t: tag(prefix, kind), ...data }); },
    broadcast(kind, data = {}) { NET.broadcast({ t: tag(prefix, kind), ...data }, 'player'); },
    lobby() { if (net.role === 'host') NET.broadcast({ t: tag(prefix, 'lobby') }, 'player'); },
    on(kind, fn) { (handlers[tag(prefix, kind)] ||= []).push(fn); return room; },
    onJoin(fn) { (handlers[':join'] ||= []).push(fn); return room; },
    onLeave(fn) { (handlers[':leave'] ||= []).push(fn); return room; },
    stop() { live = false; offs.forEach(f => f && f()); }
  };
  return room;
}

// Guest side. Shows a waiting screen (joining, waiting for the host, reconnecting, host ended the party) and routes the
// host's messages to on.start / on.snap / on.lobby / on.<kind>. `words` overrides the waiting lines per game.
export function guestRoom({ prefix, code, L = defL, game = '', help = '', words = {}, name, on = {}, onEnd } = {}) {
  let el = null, live = true;
  const W = {
    joining: c => L(`Joining room <b>${c}</b>…`, `Entrando a la sala <b>${c}</b>…`),
    failed: (c, why) => L(`Couldn't reach room <b>${c}</b> (${esc(why)}). Check the code, and that the host still has ${game} open.`, `No se pudo entrar a la sala <b>${c}</b> (${esc(why)}). Revisa el código y que el anfitrión tenga ${game} abierto.`),
    youreIn: me => L(`You're in as <b style="color:${me.color}">${esc(me.name)}</b>! Waiting for the host to start…`, `¡Entraste como <b style="color:${me.color}">${esc(me.name)}</b>! Esperando a que el anfitrión empiece…`),
    hostBack: () => L('The host went back to the menu. Waiting for the next game…', 'El anfitrión volvió al menú. Esperando la próxima partida…'),
    ended: () => L('The host ended the party. Thanks for playing!', 'El anfitrión terminó la fiesta. ¡Gracias por jugar!'),
    reconnecting: () => L('Reconnecting to the room…', 'Reconectando a la sala…'),
    title: () => L('Online game', 'Partida en línea'),
    ...words
  };
  const room = {
    prefix, code,
    get me() { return net.me; },
    get open() { return !!el; },
    // the waiting screen (also used by games between rounds, e.g. after the results card)
    wait(html, retry = false) {
      if (!el) { el = document.createElement('div'); el.className = 'ig-screen ig-room'; document.body.appendChild(el); }
      el.innerHTML = `<div class="ig-card"><div class="ig-kicker">${game} · ${L('Online room', 'Sala en línea')} ${esc(code)}</div><h2>${W.title()}</h2><p class="ig-sub">${html}</p>${help ? `<p class="ig-sub" style="font-size:13px">${help}</p>` : ''}<div class="ig-row"><a class="ig-btn ghost" href="../index.html">Hub</a>${retry ? `<button class="ig-btn" data-a="retry">${L('Try again', 'Reintentar')}</button>` : ''}</div></div>`;
      const rb = el.querySelector('[data-a=retry]'); if (rb) rb.onclick = () => { net.role = null; room.join(); };
    },
    close() { if (el) { el.remove(); el = null; } },
    async join() {
      room.wait(W.joining(code));
      let nm = name; if (nm == null) { nm = ''; try { nm = (JSON.parse(localStorage.getItem('inoa.pad') || '{}').name) || ''; } catch (e) { } }
      try { await NET.join(code, { kind: 'player', name: nm }); }
      catch (e) { room.wait(W.failed(code, e.message), true); return false; }
      room.wait(W.youreIn(net.me)); return true;
    },
    sendInput(state) { NET.sendInput(state); },
    act(kind, data = {}) { NET.sendMsg({ t: tag(prefix, kind), ...data }); },
    stop() { live = false; offs.forEach(f => f && f()); }
  };
  const offs = [
    net.on('msg', m => {
      if (!live || !m || typeof m.t !== 'string') return;
      if (m.t === tag(prefix, 'start')) { room.close(); document.querySelectorAll('.ig-results').forEach(e => e.remove()); on.start && on.start(m); }
      else if (m.t === prefix) on.snap && on.snap(m);
      else if (m.t === tag(prefix, 'lobby')) { if (!on.lobby || on.lobby(m) !== false) room.wait(W.hostBack()); }
      else if (m.t.startsWith(prefix + '-')) { const f = on[m.t.slice(prefix.length + 1)]; f && f(m); }
    }),
    net.on('status', st => {
      if (!live) return;
      if (st === 'ended') { onEnd && onEnd(); room.wait(W.ended()); }
      else if (st === 'reconnecting' && (!on.busy || !on.busy())) room.wait(W.reconnecting());
      else if (st === 'ready' && net.me && (!on.busy || !on.busy())) room.wait(W.youreIn(net.me));
    })
  ];
  return room;
}
