// Dominoes rules (double-six), pure functions for engine/cardroom.js. No DOM, no randomness except the rng passed in.
// Unit tests: node test/dominoes_rules.js
//
// THE RULES WE PLAY (documented in docs/AUDIT.md → Dominoes too)
// • Set: double-six, 28 tiles. 2–4 players. Turn order goes around the table (seat 0 → 1 → 2 → 3).
// • Modes
//   - Block: 7 tiles each; the rest stay face down and are never used. If you cannot play, you pass.
//   - Draw: 7 tiles each with 2 players, 5 each with 3–4. If you cannot play you draw from the boneyard, one tile at a
//     time, until you can play; when the boneyard is empty you pass.
// • Teams (optional, 4 players): partners sit across (seats 0 + 2 vs 1 + 3), as played in the Dominican Republic and
//   Puerto Rico. Partners share one score.
// • Opening: in the first round of a match the player holding the highest double opens with it (if nobody holds a double,
//   which can happen in Draw, the heaviest tile opens). In later rounds the winner of the previous round leads with any
//   tile; after a tied blocked round the lead passes to the player after the previous leader.
// • The line has two open ends. A tile must match the number on the end it joins. Doubles are laid crosswise.
//   (When both ends show the same number the two sides are equivalent, so only one placement is listed.)
// • Round end
//   - Domino: a player plays their last tile. Their side scores the pips left in the losers' hands (every other player;
//     with teams, the two opponents. Option countAll: also count the partner's tiles, a common Dominican house rule).
//   - Blocked ("tranque"): every player passes in a row. The side with the fewest pips wins (teams compare the two
//     partners' combined pips) and scores the losers' pips. A tie for fewest = nobody scores that round.
// • Capicúa (optional bonus, off by default): when the domino tile could have been played on either end, and the two ends
//   showed different numbers, the winners get +25. A double can never be a capicúa.
// • Match: the first side to reach the target (50 / 100 / 150 / 200 points) wins.

import { shuffle, nextSeat, partnerOf, sideOf } from '../engine/cardroom.js';

export const TILES = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push([a, b]);
export const key = t => `${Math.min(t[0], t[1])}-${Math.max(t[0], t[1])}`;
export const pips = t => t[0] + t[1];
export const isDouble = t => t[0] === t[1];
export const handPips = h => h.reduce((s, t) => s + pips(t), 0);
export const CAPICUA_BONUS = 25;
export const TARGETS = [50, 100, 150, 200];
export const handSize = (mode, n) => mode === 'draw' && n > 2 ? 5 : 7;
const same = (a, b) => key(a) === key(b);
const has = (t, v) => t[0] === v || t[1] === v;

export function sides(opts) { return opts.teams && opts.n === 4 ? 2 : opts.n; }

// opts: {n, mode:'draw'|'block', teams, capicua, countAll, target}
export function newRound(opts, rng = Math.random, { leader = null } = {}) {
  const n = Math.max(2, Math.min(4, opts.n | 0 || 4)), mode = opts.mode === 'draw' ? 'draw' : 'block', teams = !!opts.teams && n === 4;
  const deck = shuffle(TILES, rng), hs = handSize(mode, n), hands = [];
  for (let s = 0; s < n; s++) hands.push(deck.splice(0, hs).sort((a, b) => pips(b) - pips(a) || b[1] - a[1]));
  let turn = leader, forced = null;
  if (turn == null || turn >= n) {
    // highest double opens; else the heaviest tile
    let best = null;
    hands.forEach((h, s) => h.forEach(t => { const sc = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(t[0], t[1]) * .1; if (!best || sc > best.sc) best = { sc, s, t }; }));
    turn = best.s; forced = best.t.slice();
  }
  return { n, mode, teams, capicua: !!opts.capicua, countAll: !!opts.countAll, hands, boneyard: mode === 'draw' ? deck : [], sleeping: mode === 'block' ? deck.length : 0,
    line: [], ends: null, turn, leader: turn, forced, passes: 0, passLog: [], history: [], over: null };
}

export const turnOf = st => st.over ? null : st.turn;
export const moveKey = m => m.type === 'play' ? `p:${key(m.tile)}:${m.end}` : m.type;

export function legalMoves(st, seat) {
  if (st.over || seat !== st.turn) return [];
  const hand = st.hands[seat], out = [];
  if (!st.line.length) {
    for (const t of hand) if (!st.forced || same(t, st.forced)) out.push({ type: 'play', tile: t.slice(), end: 'L' });
    return out;
  }
  const [L, R] = st.ends;
  for (const t of hand) {
    if (has(t, L)) out.push({ type: 'play', tile: t.slice(), end: 'L' });
    if (has(t, R) && L !== R) out.push({ type: 'play', tile: t.slice(), end: 'R' });
  }
  if (out.length) return out;
  return [st.mode === 'draw' && st.boneyard.length ? { type: 'draw' } : { type: 'pass' }];
}
export const canPlay = (st, seat) => legalMoves(st, seat).some(m => m.type === 'play');
// which ends a tile fits (for the UI: glow both ends, ask when it fits both)
export function fits(st, tile) {
  if (!st.line.length) return ['L'];
  const [L, R] = st.ends, o = []; if (has(tile, L)) o.push('L'); if (has(tile, R) && L !== R) o.push('R'); return o;
}

function clone(st) { return { ...st, hands: st.hands.map(h => h.map(t => t.slice())), boneyard: st.boneyard.slice(), line: st.line.slice(), ends: st.ends && st.ends.slice(), passLog: st.passLog.slice(), history: st.history.slice() }; }

// Caller (cardroom.createMatch.act) guarantees the move is legal; applyMove still refuses obvious nonsense.
export function applyMove(st0, seat, mv) {
  const st = clone(st0), n = st.n;
  if (mv.type === 'play') {
    const hand = st.hands[seat], i = hand.findIndex(t => same(t, mv.tile)); if (i < 0) throw new Error('tile not in hand');
    const t = hand.splice(i, 1)[0];
    const capicua = st.line.length > 0 && st.ends[0] !== st.ends[1] && has(t, st.ends[0]) && has(t, st.ends[1]) && !isDouble(t);
    let entry;
    if (!st.line.length) { entry = { t, end: 'L', inner: t[0], outer: t[1], seat }; st.ends = [t[0], t[1]]; }
    else if (mv.end === 'L') { const inner = st.ends[0], outer = t[0] === inner ? t[1] : t[0]; entry = { t, end: 'L', inner, outer, seat }; st.ends[0] = outer; }
    else { const inner = st.ends[1], outer = t[0] === inner ? t[1] : t[0]; entry = { t, end: 'R', inner, outer, seat }; st.ends[1] = outer; }
    if (mv.end === 'L') st.line.unshift(entry); else st.line.push(entry);
    st.forced = null; st.passes = 0; st.history.push({ seat, type: 'play', tile: t.slice(), end: entry.end });
    if (!hand.length) { st.over = score(st, 'domino', seat, capicua); return st; }
    st.turn = nextSeat(seat, n); return st;
  }
  if (mv.type === 'draw') {
    if (!st.boneyard.length) throw new Error('boneyard empty');
    st.hands[seat].push(st.boneyard.pop()); st.history.push({ seat, type: 'draw' }); return st; // same player keeps the turn
  }
  // pass
  st.passes++; st.passLog.push({ seat, ends: st.ends ? st.ends.slice() : null }); st.history.push({ seat, type: 'pass' });
  if (st.passes >= n) { st.over = score(st, 'blocked', null, false); return st; }
  st.turn = nextSeat(seat, n); return st;
}

export function score(st, type, winner, capicua) {
  const n = st.n, pipsBy = st.hands.map(handPips), teams = st.teams, side = s => sideOf(s, teams);
  let points = 0, winSide = null, w = winner;
  if (type === 'domino') {
    winSide = side(winner);
    for (let s = 0; s < n; s++) if (side(s) !== winSide || (st.countAll && s !== winner)) points += pipsBy[s];
  } else {
    const nS = teams ? 2 : n, tot = new Array(nS).fill(0); for (let s = 0; s < n; s++) tot[side(s)] += pipsBy[s];
    const min = Math.min(...tot), at = tot.map((v, i) => v === min ? i : -1).filter(i => i >= 0);
    if (at.length === 1) {
      winSide = at[0]; for (let i = 0; i < nS; i++) if (i !== winSide) points += tot[i];
      // the winning seat (leads next round): the lighter hand on the winning side, lower seat on a tie
      w = null; for (let s = 0; s < n; s++) if (side(s) === winSide && (w == null || pipsBy[s] < pipsBy[w])) w = s;
    } else w = null;
  }
  const bonus = type === 'domino' && capicua && st.capicua ? CAPICUA_BONUS : 0;
  return { type, winner: w, side: winSide, points: points + bonus, bonus, capicua: !!(type === 'domino' && capicua), pips: pipsBy, tie: type === 'blocked' && w == null, nextLeader: w != null ? w : nextSeat(st.leader, n) };
}
export const roundOver = st => st.over;

// What one seat may know: its own hand, the table, everyone's tile counts, who passed on which ends. Never other hands.
export function view(st, seat) {
  return { seat, n: st.n, mode: st.mode, teams: st.teams, hand: st.hands[seat].map(t => t.slice()), counts: st.hands.map(h => h.length), boneyard: st.boneyard.length,
    line: st.line.map(e => e.t.slice()), ends: st.ends && st.ends.slice(), turn: st.turn, forced: st.forced && st.forced.slice(), passLog: st.passLog.map(p => ({ seat: p.seat, ends: p.ends && p.ends.slice() })),
    legal: legalMoves(st, seat), over: st.over };
}

/* ---------------- bots: they decide from view() only ---------------- */
// Chill: any legal tile (a little random). Normal: dump the heaviest tile, doubles first.
// Sharp: also keeps numbers it holds on the ends, plays numbers the next opponent passed on, avoids numbers the partner
// passed on, and counts which numbers are still unseen.
export function botMove(v, skill = 'normal', rng = Math.random) {
  const moves = v.legal; if (!moves.length) return { type: 'pass' };
  const plays = moves.filter(m => m.type === 'play'); if (!plays.length) return moves[0];
  if (plays.length === 1) return plays[0];
  if (skill === 'chill') return rng() < .65 ? plays[Math.floor(rng() * plays.length)] : best(plays, m => pips(m.tile) + rng() * 6);
  if (skill !== 'sharp') return best(plays, m => pips(m.tile) + (isDouble(m.tile) ? 3 : 0) + rng() * 1.5);
  const n = v.n, next = nextSeat(v.seat, n), partner = v.teams ? partnerOf(v.seat, n) : null;
  const lacks = s => { const o = new Set(); for (const p of v.passLog) if (p.seat === s && p.ends) p.ends.forEach(x => o.add(x)); return o; };
  const nextLacks = lacks(next), partnerLacks = partner != null ? lacks(partner) : new Set();
  const seen = new Array(7).fill(0); for (const t of v.line) { seen[t[0]]++; if (t[1] !== t[0]) seen[t[1]]++; }
  return best(plays, m => {
    const t = m.tile, rest = v.hand.filter(x => !same(x, t));
    if (!rest.length) return 1e6; // domino
    let ends;
    if (!v.line.length) ends = [t[0], t[1]];
    else { ends = v.ends.slice(); const i = m.end === 'L' ? 0 : 1, inner = ends[i]; ends[i] = t[0] === inner ? t[1] : t[0]; }
    let s = pips(t) * 1.1 + (isDouble(t) ? 5 : 0);
    for (const e of new Set(ends)) {
      const mine = rest.filter(x => has(x, e)).length, mineSeen = v.hand.filter(x => has(x, e)).length;
      s += mine * 2.2;
      if (nextLacks.has(e)) s += 3.5;
      if (partnerLacks.has(e)) s -= 2.5;
      // all 7 tiles of that number are visible to me (line + my hand) and I hold none left: the end is dead for everyone
      if (seen[e] + mineSeen >= 7 && !mine) s -= 1;
    }
    return s + rng() * .5;
  });
}
function best(list, f) { let b = null, bs = -Infinity; for (const x of list) { const s = f(x); if (s > bs) { bs = s; b = x; } } return b; }

export const GAME = { newRound, turnOf, legalMoves, moveKey, applyMove, view, botMove, roundOver, sides };
