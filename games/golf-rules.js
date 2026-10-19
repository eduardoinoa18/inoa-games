// Six-Card Golf rules, pure functions for engine/cardroom.js. No DOM, no randomness except the rng passed in
// (the stock reshuffle uses a seed kept in the state, so replays are repeatable). Unit tests: node test/golf_rules.js
//
// THE RULES WE PLAY (standard Six-Card Golf; also in docs/AUDIT.md → Six-Card Golf)
// • Deck: one 52-card deck. Option: add 2 jokers (worth −2 each). 2–4 players.
// • Deal: 6 cards face down to each player in a grid of 2 rows × 3 columns (slots 0 1 2 on the far row, 3 4 5 on the
//   near row; a column is slots i and i+3). The next stock card is turned up to start the discard pile.
// • Setup: starting with the hole's first player and going around, each player turns 2 of their cards face up.
// • A turn: draw the top card of the stock (only you see it) OR take the top card of the discard pile. Then either
//   - swap it for one of your 6 cards (face up or face down); the card you replace goes face up on the discard pile, or
//   - (only a card drawn from the stock) put it on the discard pile and turn one of your face-down cards face up.
//   A card taken from the discard pile must be swapped in.
// • When the stock runs out, the discard pile except its top card is shuffled into a new stock.
// • End of a hole: when a player has all 6 cards face up, every other player gets exactly one more turn. Then every card
//   is turned up and scored. (Friendly guard, not in the classic rules: if nobody has gone out after 30 turns each,
//   every card is turned up and the hole is scored. Bots never need it; it stops an endless hole.)
// • Scoring per card: A = 1, 2 = −2, 3–10 = face value, J = 10, Q = 10, K = 0, joker = −2.
//   A column whose two cards have the same rank (a pair, e.g. two 7s or two kings) scores 0 for that column — this
//   includes a pair of 2s or of jokers, which cancel to 0 too (the classic rule).
// • Lowest score wins the hole. A match is 9 holes (or 3 for a quick game; 6 also offered); the lowest total wins.
//   The first player rotates each hole.

import { shuffle, nextSeat, makeRng } from '../engine/cardroom.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const HOLES = [3, 6, 9];
export const TURN_CAP = 30; // turns per player before the friendly guard ends a hole
export const COLS = [[0, 3], [1, 4], [2, 5]];
export const RANK_LABEL = { 0: '★', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const label = c => c ? (RANK_LABEL[c.r] || String(c.r)) : '';
export const value = c => c.r === 0 ? -2 : c.r === 2 ? -2 : c.r === 13 ? 0 : c.r >= 11 ? 10 : c.r;
export const sameRank = (a, b) => !!a && !!b && a.r === b.r;
export function makeDeck(jokers = false) {
  const d = []; for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ r, s, id: s + r });
  if (jokers) d.push({ r: 0, s: 'X', id: 'X1' }, { r: 0, s: 'X', id: 'X2' });
  return d;
}
const cp = c => c && { r: c.r, s: c.s, id: c.id };

// score of a full grid of 6 cards (all revealed): column pairs cancel to 0
export function gridScore(cards) {
  let t = 0; for (const [a, b] of COLS) t += sameRank(cards[a], cards[b]) ? 0 : value(cards[a]) + value(cards[b]); return t;
}
// score of what is visible: face-up cards only; a pair counts only when both cards are up
export function visibleScore(cells) {
  let t = 0; for (const [a, b] of COLS) { const A = cells[a], B = cells[b];
    if (A.up && B.up) t += sameRank(A.card, B.card) ? 0 : value(A.card) + value(B.card); else { if (A.up) t += value(A.card); if (B.up) t += value(B.card); } }
  return t;
}
// how much one column contributes to the visible score
function colVisible(cells, k) { const [a, b] = COLS[k], A = cells[a], B = cells[b]; if (A.up && B.up) return sameRank(A.card, B.card) ? 0 : value(A.card) + value(B.card); return (A.up ? value(A.card) : 0) + (B.up ? value(B.card) : 0); }
export const colOf = i => i % 3;
export const partner = i => i < 3 ? i + 3 : i - 3;

// opts: {n, jokers, holes}
export function newRound(opts, rng = Math.random, { round = 0 } = {}) {
  const n = Math.max(2, Math.min(4, opts.n | 0 || 4)), jokers = !!opts.jokers;
  const stock = shuffle(makeDeck(jokers), rng), grids = [];
  for (let s = 0; s < n; s++) grids.push(stock.splice(0, 6).map(card => ({ card, up: false })));
  const discard = [stock.pop()], start = (round | 0) % n;
  return { n, jokers, stock, discard, grids, phase: 'setup', turn: start, start, flips: new Array(n).fill(0), held: null,
    finisher: null, lastLeft: 0, turns: 0, seed: Math.floor(rng() * 2 ** 31) || 1, history: [], over: null };
}

export const turnOf = st => st.over ? null : st.turn;
export const moveKey = m => m.type === 'draw' ? `d:${m.from}` : `${m.type}:${m.i}`;
export const faceDown = (st, seat) => st.grids[seat].map((c, i) => c.up ? -1 : i).filter(i => i >= 0);
const canDrawStock = st => st.stock.length > 0 || st.discard.length > 1;

export function legalMoves(st, seat) {
  if (st.over || seat !== st.turn) return [];
  if (st.phase === 'setup') return faceDown(st, seat).map(i => ({ type: 'flip', i }));
  if (!st.held) { const o = []; if (canDrawStock(st)) o.push({ type: 'draw', from: 'stock' }); if (st.discard.length) o.push({ type: 'draw', from: 'discard' }); return o; }
  const o = []; for (let i = 0; i < 6; i++) o.push({ type: 'swap', i });
  if (st.held.from === 'stock') for (const i of faceDown(st, seat)) o.push({ type: 'discardFlip', i });
  return o;
}

function clone(st) { return { ...st, stock: st.stock.slice(), discard: st.discard.slice(), grids: st.grids.map(g => g.map(c => ({ card: c.card, up: c.up }))), flips: st.flips.slice(), held: st.held && { ...st.held }, history: st.history.slice() }; }

// Caller (cardroom.createMatch.act) guarantees the move is legal; applyMove still refuses obvious nonsense.
export function applyMove(st0, seat, mv) {
  const st = clone(st0), g = st.grids[seat];
  if (mv.type === 'flip') {
    if (st.phase !== 'setup' || g[mv.i].up) throw new Error('bad flip');
    g[mv.i].up = true; st.flips[seat]++; st.history.push({ seat, type: 'flip', i: mv.i });
    if (st.flips[seat] >= 2) { st.turn = nextSeat(seat, st.n); if (st.turn === st.start) st.phase = 'play'; }
    return st;
  }
  if (mv.type === 'draw') {
    if (st.held) throw new Error('already holding');
    if (mv.from === 'discard') { if (!st.discard.length) throw new Error('discard empty'); st.held = { card: st.discard.pop(), from: 'discard' }; }
    else {
      if (!st.stock.length) { const top = st.discard.pop(); st.stock = shuffle(st.discard, makeRng(st.seed)); st.seed = (st.seed * 48271) % 2147483647 || 1; st.discard = [top]; st.reshuffles = (st.reshuffles || 0) + 1; }
      if (!st.stock.length) throw new Error('stock empty');
      st.held = { card: st.stock.pop(), from: 'stock' };
    }
    st.history.push({ seat, type: 'draw', from: mv.from }); return st; // same player keeps the turn
  }
  if (!st.held) throw new Error('nothing held');
  if (mv.type === 'swap') {
    const old = g[mv.i].card; g[mv.i] = { card: st.held.card, up: true }; st.discard.push(old);
    st.history.push({ seat, type: 'swap', i: mv.i, card: cp(st.held.card), out: cp(old) });
  } else if (mv.type === 'discardFlip') {
    if (st.held.from !== 'stock' || g[mv.i].up) throw new Error('bad discard + flip');
    st.discard.push(st.held.card); g[mv.i].up = true; st.history.push({ seat, type: 'discardFlip', i: mv.i, card: cp(st.held.card) });
  } else throw new Error('unknown move');
  st.held = null; return endTurn(st, seat);
}

function endTurn(st, seat) {
  st.turns++;
  const allUp = st.grids[seat].every(c => c.up);
  if (st.finisher == null && allUp) { st.finisher = seat; st.lastLeft = st.n - 1; }
  else if (st.finisher != null) st.lastLeft--;
  if (st.finisher != null && st.lastLeft <= 0) { st.over = score(st, 'out'); return st; }
  if (st.finisher == null && st.turns >= TURN_CAP * st.n) { st.over = score(st, 'limit'); return st; }
  st.turn = nextSeat(seat, st.n); return st;
}

export function score(st, type = 'out') {
  for (const g of st.grids) for (const c of g) c.up = true;
  const scores = st.grids.map(g => gridScore(g.map(c => c.card))), min = Math.min(...scores), at = scores.map((v, i) => v === min ? i : -1).filter(i => i >= 0);
  const pairs = st.grids.map(g => COLS.filter(([a, b]) => sameRank(g[a].card, g[b].card)).length);
  return { type, finisher: st.finisher, scores, pairs, winner: at[0], side: at[0], winners: at, tie: at.length > 1, points: 0, nextLeader: null };
}
export const roundOver = st => st.over;
export function sides(opts) { return Math.max(2, Math.min(4, opts.n | 0 || 4)); }
// match end: after the last hole the lowest total wins (ties share the win; winner = lowest seat among them)
export function matchOver(scores, rounds, opts) {
  const holes = opts.holes || 9; if (rounds < holes) return null;
  const min = Math.min(...scores), winners = scores.map((v, i) => v === min ? i : -1).filter(i => i >= 0);
  return { winner: winners[0], winners, tie: winners.length > 1 };
}

// What one seat may know: every face-up card, the whole discard pile (everyone saw it), the stock's size, and the
// card it is holding. Never a face-down card (its own included) or the stock order. The held card of another player
// is visible only when it came from the discard pile (everyone saw where it came from).
export function view(st, seat) {
  const held = st.held ? (st.turn === seat || st.held.from === 'discard' ? { card: cp(st.held.card), from: st.held.from } : { card: null, from: st.held.from }) : null;
  return { seat, n: st.n, jokers: st.jokers, phase: st.phase, turn: st.turn, start: st.start, flips: st.flips.slice(), turns: st.turns,
    grids: st.grids.map(g => g.map(c => c.up ? { up: true, card: cp(c.card) } : { up: false, card: null })),
    discard: st.discard.map(cp), stock: st.stock.length, held, finisher: st.finisher, lastLeft: st.lastLeft,
    legal: legalMoves(st, seat), over: st.over && { ...st.over } };
}

// Online guests (engine/cardroom.js mirrorMatch): the full state shape with only what view() allows: face-down cards
// (its own included) and the stock order become nulls, another player's card from the stock stays hidden, no reshuffle seed.
export function redact(st, seat) {
  const r = clone(st);
  r.grids = st.grids.map(g => g.map(c => c.up ? { up: true, card: cp(c.card) } : { up: false, card: null }));
  r.stock = st.stock.map(() => null); r.seed = 0;
  if (st.held && st.turn !== seat && st.held.from === 'stock') r.held = { card: null, from: 'stock' };
  r.history = st.history.map(h => h.seat === seat || h.type !== 'draw' ? { ...h } : { seat: h.seat, type: h.type, from: h.from });
  return r;
}

/* ---------------- helpers for hints and bots (view-only information) ---------------- */
// estimated grid score: unknown cards count as E; a column pair only counts when both are known
export function estimate(cells, E = 5) {
  let t = 0; for (const [a, b] of COLS) { const A = cells[a], B = cells[b];
    if (A.up && B.up) t += sameRank(A.card, B.card) ? 0 : value(A.card) + value(B.card); else t += (A.up ? value(A.card) : E) + (B.up ? value(B.card) : E); }
  return t;
}
const withCard = (cells, i, card) => cells.map((c, k) => k === i ? { up: true, card } : c);
// Hint: what swapping `card` into each slot does to your visible score (negative = lower = better). Face-down slots
// are unknown, so they report null (the hint says "replaces a hidden card").
export function swapDeltas(cells, card) {
  return cells.map((c, i) => c.up ? colVisible(withCard(cells, i, card), colOf(i)) - colVisible(cells, colOf(i)) : null);
}

/* ---------------- bots: they decide from view() only ---------------- */
// Chill: often a random legal move, noisy estimates. Normal: lowest estimated score (unknown cards ≈ 5), only goes out
// when its score beats what the others show. Sharp: counts the unseen cards (better estimate + odds of a column pair),
// avoids handing the next player a card that pairs for them, and times going out.
export const BOT = { chill: { rand: .32, noise: 5, take: 3, out: 0 }, normal: { rand: 0, noise: .6, take: 1.5, out: 1 }, sharp: { rand: 0, noise: .1, take: 1, out: 1, count: 1, deny: .5 } };
export function botMove(v, skill = 'normal', rng = Math.random) {
  const moves = v.legal; if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const P = BOT[skill] || BOT.normal, me = v.grids[v.seat];
  if (v.phase === 'setup') {
    if (skill === 'chill') return moves[Math.floor(rng() * moves.length)];
    const free = moves.filter(m => !me[partner(m.i)].up); // a column with nothing up yet: more information
    const pool = free.length ? free : moves; return pool[Math.floor(rng() * pool.length)];
  }
  if (P.rand && rng() < P.rand) return moves[Math.floor(rng() * moves.length)];
  // what I know: unseen cards (Sharp counts them; the others assume an average of about 5)
  let E = 5.2, unseen = null;
  if (P.count) {
    const seen = new Set(); for (const g of v.grids) for (const c of g) if (c.up) seen.add(c.card.id); for (const c of v.discard) seen.add(c.id); if (v.held && v.held.card) seen.add(v.held.card.id);
    unseen = makeDeck(v.jokers).filter(c => !seen.has(c.id)); if (unseen.length) E = unseen.reduce((t, c) => t + value(c), 0) / unseen.length;
  }
  const pairOdds = r => unseen && unseen.length ? unseen.filter(c => c.r === r).length / unseen.length : 0;
  const colExp = (A, B) => {
    if (A.up && B.up) return sameRank(A.card, B.card) ? 0 : value(A.card) + value(B.card);
    if (A.up || B.up) { const k = A.up ? A.card : B.card, p = pairOdds(k.r); return (1 - p) * (value(k) + E); }
    return 2 * E;
  };
  const exp = cells => COLS.reduce((t, [a, b]) => t + colExp(cells[a], cells[b]), 0);
  const lastTurn = v.finisher != null;
  const oppBest = Math.min(...v.grids.map((g, s) => s === v.seat ? Infinity : exp(g)));
  const next = v.grids[(v.seat + 1) % v.n];
  // a card on top of the discard that the next player could pair with one of their face-up cards
  const gift = card => { if (!P.deny || !card) return 0; for (const [a, b] of COLS) { const A = next[a], B = next[b]; if ((A.up && !B.up && sameRank(A.card, card)) || (B.up && !A.up && sameRank(B.card, card))) return P.deny * Math.max(2, value(card)); if (A.up && B.up && !sameRank(A.card, B.card) && (sameRank(A.card, card) || sameRank(B.card, card))) return P.deny * Math.max(0, Math.max(value(A.card), value(B.card)) - 2); } return 0; };
  // going out early ends the hole: fine when my final score beats what the others are likely to score
  const outPenalty = cells => { if (!P.out || lastTurn || !cells.every(c => c.up)) return 0; const fin = exp(cells); return fin <= oppBest - 1 ? -1 : 6 + (fin - oppBest); };
  const noise = () => (rng() - .5) * P.noise;
  const withC = (i, card) => me.map((c, k) => k === i ? { up: true, card } : c);
  const evalSwap = (i, card) => exp(withC(i, card)) + outPenalty(withC(i, card)) + gift(me[i].up ? me[i].card : null) * (me[i].up ? 1 : .5);
  if (!v.held) {
    const top = v.discard[v.discard.length - 1];
    if (!moves.some(m => m.from === 'stock')) return { type: 'draw', from: 'discard' };
    const cur = exp(me); let best = Infinity; for (let i = 0; i < 6; i++) best = Math.min(best, evalSwap(i, top));
    return cur - best + noise() >= P.take ? { type: 'draw', from: 'discard' } : { type: 'draw', from: 'stock' };
  }
  const card = v.held.card; let pick = null, ps = Infinity;
  for (const m of moves) {
    let s;
    if (m.type === 'swap') s = evalSwap(m.i, card);
    else {
      // turn a face-down card up: in expectation its column stays the same; the drawn card goes to the discard pile
      const cells = me.map((c, k) => k === m.i ? { ...c, flipping: true } : c);
      s = exp(me) - .3 + gift(card);
      if (cells.every(c => c.up || c.flipping) && !lastTurn && P.out) { const fin = exp(me); s += fin <= oppBest - 1 ? -1 : 6 + (fin - oppBest); }
      if (P.count) { const pc = me[partner(m.i)]; if (pc.up) s -= pairOdds(pc.card.r) * value(pc.card) * .5; }
    }
    s += noise();
    if (s < ps) { ps = s; pick = m; }
  }
  return pick;
}

export const GAME = { newRound, turnOf, legalMoves, moveKey, applyMove, view, redact, botMove, roundOver, sides, matchOver };
