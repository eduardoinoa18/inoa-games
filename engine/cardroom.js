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
export function makeSeats({ players = 4, locals = 1, phones = [], names = [], botNames = [], skill = 'normal' } = {}) {
  const seats = []; let bi = 0;
  for (let i = 0; i < players; i++) {
    if (i < locals) seats.push({ i, kind: 'local', name: names[i] || `P${i + 1}` });
    else if (i - locals < phones.length) { const p = phones[i - locals]; seats.push({ i, kind: 'phone', slot: p.slot, name: String(p.name || `P${i + 1}`).slice(0, 14) }); }
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
        m.last = over; if (over.side != null && over.points) m.scores[over.side] += over.points;
        const target = opts.target || 100, top = Math.max(...m.scores);
        if (top >= target) { m.winnerSide = m.scores.indexOf(top); m.phase = 'matchEnd'; } else m.phase = 'roundEnd';
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
