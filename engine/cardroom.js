// Card Room: shared table-game infrastructure (docs/DECISIONS/0004-card-room.md).
// Seats + turn order, the match lifecycle (lobby → deal → turns → round end → match end), a bot interface, per-seat hidden
// views, host-authoritative move checks and phone hands through engine/net.js. Each game supplies its own rules as pure
// functions (see games/dominoes-rules.js); this module has no DOM or three.js dependency, so Node can unit-test it.
//
// A game object implements:
//   newRound(opts, rng, {leader, round}) → state            deal a fresh round
//   turnOf(state) → seat                                     whose turn it is (null when the round is over)
//   legalMoves(state, seat) → [move]                         every legal move for that seat (empty when not its turn)
//   moveKey(move) → string                                   identity used to compare a move against the legal list
//   applyMove(state, seat, move) → state                     returns the next state (never called with an illegal move)
//   view(state, seat) → view                                 what that seat may know: its own hand, the table, counts
//   botMove(view, skill, rng) → move                         bot strategy; sees ONLY the view (never other hands)
//   roundOver(state) → null | {winner, side, points, ...}    set when the round has ended
//   sides(opts) → number                                     how many score columns (players, or 2 teams)
// Optional (Six-Card Golf):
//   roundOver(...).scores = [n per side]                     every column adds its own round score (instead of side+points)
//   matchOver(scores, roundsPlayed, opts) → null | {winner}  the game decides when the match ends (default: first to
//                                                            opts.target points); m.result keeps what it returned
//
// Bots: skill is 'chill' | 'normal' | 'sharp'.

export const SKILLS = ['chill', 'normal', 'sharp'];

// Small seeded RNG (mulberry32) so tests and daily seeds are repeatable.
export function makeRng(seed = Date.now()) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, rng = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Seats sit around the table in turn order (counter-clockwise when drawn). With 4 players and teams, partners sit across.
export const nextSeat = (s, n) => (s + 1) % n;
export const partnerOf = (s, n) => n === 4 ? (s + 2) % 4 : null;
export const sideOf = (s, teams) => teams ? s % 2 : s;

// Build the seat list: local humans first, then phones, then bots fill the rest.
// kind: 'local' (this screen; pass-and-play when there are several), 'phone' (private hand on a phone), 'bot'.
// online: players on their own screen (engine/room.js guests), seated after the phones.
export function makeSeats({ players = 4, locals = 1, phones = [], online = [], names = [], botNames = [], skill = 'normal' } = {}) {
  const seats = []; let bi = 0;
  for (let i = 0; i < players; i++) {
    if (i < locals) seats.push({ i, kind: 'local', name: names[i] || `P${i + 1}` });
    else if (i - locals < phones.length) { const p = phones[i - locals]; seats.push({ i, kind: 'phone', slot: p.slot, name: String(p.name || `P${i + 1}`).slice(0, 14) }); }
    else if (i - locals - phones.length < online.length) { const p = online[i - locals - phones.length]; seats.push({ i, kind: 'online', slot: p.slot, name: String(p.name || `P${i + 1}`).slice(0, 14) }); }
    else seats.push({ i, kind: 'bot', skill, name: botNames[bi++ % Math.max(1, botNames.length)] || `Bot ${bi}` });
  }
  return seats;
}

// The match controller. Host-authoritative: every move (from this screen, a phone or a bot) goes through act(), which
// rejects moves out of turn and moves that are not in the rules' legal list.
export function createMatch(game, { seats, opts = {}, seed } = {}) {
  const rng = makeRng(seed ?? Math.floor(Math.random() * 2 ** 31));
  const handlers = {};
  const m = {
    game, seats, opts, rng, phase: 'lobby', round: 0, state: null, scores: new Array(game.sides(opts)).fill(0), log: [], last: null, winnerSide: null, rejected: 0,
    on(ev, fn) { (handlers[ev] ||= []).push(fn); return m; },
    emit(ev, ...a) { for (const f of handlers[ev] || []) f(...a); },
    deal() {
      const leader = m.last ? m.last.nextLeader : null;
      m.state = game.newRound(opts, rng, { leader, round: m.round }); m.round++; m.phase = 'turns'; m.emit('deal', m.state); return m.state;
    },
    turn() { return m.phase === 'turns' ? game.turnOf(m.state) : null; },
    legal(seat) { return m.phase === 'turns' ? game.legalMoves(m.state, seat) : []; },
    view(seat) { return game.view(m.state, seat); },
    isLegal(seat, move) { if (!move) return false; const k = game.moveKey(move); return m.legal(seat).some(x => game.moveKey(x) === k); },
    act(seat, move, from = 'local') {
      if (m.phase !== 'turns') return reject('not-playing');
      if (seat !== game.turnOf(m.state)) return reject('not-your-turn');
      if (!m.isLegal(seat, move)) return reject('illegal');
      const before = m.state; m.state = game.applyMove(m.state, seat, move); m.log.push({ round: m.round, seat, move, from });
      const over = game.roundOver(m.state);
      if (over) { // the phase is settled before anyone hears about the move
        m.last = over;
        if (Array.isArray(over.scores)) over.scores.forEach((v, i) => { m.scores[i] += v; }); // per-seat round scores (Golf)
        else if (over.side != null && over.points) m.scores[over.side] += over.points;
        if (game.matchOver) { const done = game.matchOver(m.scores, m.round, opts); m.result = done || null; if (done) { m.winnerSide = done.winner; m.phase = 'matchEnd'; } else m.phase = 'roundEnd'; }
        else { const target = opts.target || 100, top = Math.max(...m.scores);
          if (top >= target) { m.winnerSide = m.scores.indexOf(top); m.phase = 'matchEnd'; } else m.phase = 'roundEnd'; }
      }
      m.emit('move', seat, move, before, m.state);
      if (over) m.emit('round', over, m.phase);
      return { ok: true };
      function reject(reason) { m.rejected++; m.emit('reject', seat, move, reason, from); return { ok: false, reason }; }
    },
    // a bot decides from its own view only (no other hands) and goes through the same act() check as everyone else
    botAct(seat, skill) { const v = game.view(m.state, seat); const mv = game.botMove(v, skill || seats[seat]?.skill || 'normal', rng); return m.act(seat, mv, 'bot'); }
  };
  return m;
}

// Phone hands: each phone seat gets its own private layout through engine/net.js (pass the NET module in, so this file stays
// importable in Node). layout(seatIndex) returns a pad layout; onMsg(seatIndex, msg) receives {t:'choice'|'act', i}.
// Layouts are only re-sent when they change; a phone that reconnects gets its layout again.
export function phoneHands(NET, { seats, layout, onMsg }) {
  const sig = {}; let live = true;
  const seatOf = slot => seats.findIndex(s => s.kind === 'phone' && s.slot === slot);
  const offMsg = NET.net.on('msg', (p, msg) => { if (!live || !p) return; const i = seatOf(p.slot); if (i >= 0) onMsg(i, msg || {}); });
  const offJoin = NET.net.on('join', p => { if (p) delete sig[p.slot]; });
  return {
    sync() { if (!live || NET.net.role !== 'host') return; seats.forEach((s, i) => { if (s.kind !== 'phone') return; const L = layout(i); if (!L) return; const k = JSON.stringify(L); if (sig[s.slot] !== k) { sig[s.slot] = k; NET.setLayout(L, s.slot); } }); },
    reset() { for (const k in sig) delete sig[k]; },
    stop(final) { live = false; offMsg && offMsg(); offJoin && offJoin(); if (NET.net.role === 'host') seats.forEach(s => { if (s.kind === 'phone') NET.setLayout(final || { type: 'gamepad' }, s.slot); }); }
  };
}

// Bot thinking time (seconds) per skill, so a table feels like people taking turns.
export const botDelay = (skill, rng = Math.random) => ({ chill: 1.3, normal: 1.0, sharp: .85 }[skill] || 1) * (.75 + rng() * .6);

// ---------------- Online on separate screens (roadmap R7, engine/room.js) ----------------
// Each online player opens games/<game>.html?join=CODE on their own screen. The host keeps the only real match; after every
// deal / move / round end it sends each online seat its own copy of the state with everything that seat may not see
// removed (game.redact(state, seat): other hands, the stock order, face-down cards). The guest page runs the same table
// code against a mirrorMatch() that looks like createMatch() but sends moves to the host, which checks them with act().
// Seats for online players have kind 'online' and the player's room slot.

// Host side. room = engine/room.js hostRoom(); call before the first deal. publicSeats(): what guests may know about seats.
export function onlineHost(room, m, { publicSeats = () => m.seats.map(s => ({ name: s.name, kind: s.kind, slot: s.slot, color: s.color, emoji: s.emoji })), extra = () => ({}) } = {}) {
  let live = true;
  const seatOf = slot => m.seats.findIndex(s => s.kind === 'online' && s.slot === slot);
  const snap = (seat, ev = {}) => ({ ev, state: m.state && m.game.redact(m.state, seat), phase: m.phase, round: m.round, scores: m.scores.slice(), last: m.last, winnerSide: m.winnerSide, result: m.result || null, ...extra(seat) });
  const each = fn => m.seats.forEach((s, i) => { if (s.kind === 'online') fn(s, i); });
  const push = ev => { if (live) each((s, i) => room.send(s.slot, 'view', snap(i, ev))); };
  m.on('deal', () => push({ type: 'deal' }));
  m.on('move', (seat, move) => push({ type: 'move', seat, move, over: m.phase !== 'turns' ? m.last : null }));
  m.on('reject', (seat, move, reason, from) => { if (live && from === 'online') room.send(m.seats[seat].slot, 'rej', { reason, move }); });
  room.on('act', (p, msg) => { if (!live) return; const i = seatOf(p.slot); if (i < 0) return; m.act(i, msg.move, 'online'); });
  // a guest that reconnects (or joins mid-round) gets the table again
  room.onJoin(p => { if (!live) return; const i = seatOf(p.slot); if (i >= 0) { room.send(p.slot, 'start', { seats: publicSeats(), opts: m.opts, seat: i }); if (m.state) room.send(p.slot, 'view', snap(i, { type: 'sync' })); } });
  room.start({ seats: publicSeats(), opts: m.opts });
  return {
    resend() { push({ type: 'sync' }); },
    // a message only for online seats (e.g. 'next' when the host starts the next round, 'end' with the final scores)
    tell(kind, data) { if (live) room.broadcast(kind, data); },
    stop() { live = false; }
  };
}

// Guest side: same shape as createMatch() for the table code. act() checks turn + legality locally for instant feedback
// (the same reasons as the host), then sends the move; the host's answer arrives through apply() as a 'move' event or
// as reject(reason).
export function mirrorMatch(game, { seats, opts = {}, seat, send }) {
  const handlers = {};
  const m = {
    game, seats, opts, me: seat, phase: 'lobby', round: 0, state: null, scores: new Array(game.sides(opts)).fill(0), log: [], last: null, winnerSide: null, result: null, rejected: 0, pending: false,
    on(ev, fn) { (handlers[ev] ||= []).push(fn); return m; },
    emit(ev, ...a) { for (const f of handlers[ev] || []) f(...a); },
    turn() { return m.phase === 'turns' && m.state ? game.turnOf(m.state) : null; },
    legal(s) { return m.phase === 'turns' && m.state && s === seat ? game.legalMoves(m.state, s) : []; },
    view(s) { return game.view(m.state, s); },
    isLegal(s, move) { if (!move) return false; const k = game.moveKey(move); return m.legal(s).some(x => game.moveKey(x) === k); },
    act(s, move, from = 'local') {
      if (m.phase !== 'turns') return reject('not-playing');
      if (s !== seat || s !== game.turnOf(m.state) || m.pending) return reject('not-your-turn');
      if (!m.isLegal(s, move)) return reject('illegal');
      m.pending = true; send(move); return { ok: true, pending: true };
      function reject(reason) { m.rejected++; m.emit('reject', s, move, reason, from); return { ok: false, reason }; }
    },
    botAct() { return { ok: false, reason: 'host-only' }; },
    // a 'view' message from the host
    apply(msg) {
      const before = m.state, ev = msg.ev || {};
      Object.assign(m, { state: msg.state, phase: msg.phase, round: msg.round, scores: msg.scores, last: msg.last, winnerSide: msg.winnerSide, result: msg.result });
      if (ev.type === 'move' && ev.seat === seat) m.pending = false;
      if (ev.type === 'deal') { m.pending = false; m.emit('deal', m.state); }
      else if (ev.type === 'move') { m.log.push({ round: m.round, seat: ev.seat, move: ev.move, from: 'host' }); m.emit('move', ev.seat, ev.move, before, m.state); if (ev.over) m.emit('round', ev.over, m.phase); }
      else m.emit('sync', m.state);
    },
    reject(msg) { m.pending = false; m.rejected++; m.emit('reject', seat, msg.move, msg.reason, 'host'); }
  };
  return m;
}
