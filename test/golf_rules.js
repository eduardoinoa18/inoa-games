// Unit tests for the Six-Card Golf rules (games/golf-rules.js) on the shared Card Room match controller (engine/cardroom.js).
// usage: node test/golf_rules.js   (plain Node, no framework, no browser)
process.removeAllListeners('warning'); // the ES modules are plain .js in a typeless package; Node re-parses them (harmless warning)
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

(async () => {
  const G = await import('../games/golf-rules.js');
  const C = await import('../engine/cardroom.js');
  const { GAME } = G;
  // card helpers: 'A', '2'…'10', 'J', 'Q', 'K', '*' (joker); suits default to spades, unique ids so the set stays valid
  let uid = 0; const RK = { A: 1, J: 11, Q: 12, K: 13, '*': 0 };
  const c = (r, s = 'S') => { const rr = RK[r] ?? +r; return { r: rr, s: rr === 0 ? 'X' : s, id: (rr === 0 ? 'X' : s) + rr + '_' + (uid++) }; };
  const cards = str => str ? str.split(' ').map(x => c(x)) : [];
  // a hand-built state: grids as 6-card strings, `up` as a list of up-flags per seat (default all down)
  const mk = ({ n = 2, grids, up, stock = '5 6 7 8 9 10', discard = '4', turn = 0, phase = 'play', held = null, finisher = null, lastLeft = 0, turns = 0 }) => ({
    n, jokers: false, stock: cards(stock), discard: cards(discard), grids: grids.map((g, s) => cards(g).map((card, i) => ({ card, up: up ? !!up[s][i] : false }))),
    phase, turn, start: 0, flips: new Array(n).fill(2), held, finisher, lastLeft, turns, seed: 7, history: [], over: null });

  /* ---- deck + card values ---- */
  eq(G.makeDeck().length, 52, '52-card deck'); eq(G.makeDeck(true).length, 54, 'deck with 2 jokers');
  eq(new Set(G.makeDeck(true).map(x => x.id)).size, 54, 'card ids are unique');
  eq(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', '*'].map(r => G.value(c(r))), [1, -2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 0, -2], 'card values A=1, 2=−2, 3–10 face, J/Q=10, K=0, joker=−2');
  eq(G.label(c('A')) + G.label(c('10')) + G.label(c('Q')) + G.label(c('*')), 'A10Q★', 'labels');

  /* ---- grid scoring incl. column pairs ---- */
  // slots: 0 1 2 / 3 4 5 → columns (0,3) (1,4) (2,5)
  eq(G.gridScore(cards('A 5 9 3 7 K')), 1 + 3 + 5 + 7 + 9 + 0, 'no pairs: plain sum');
  eq(G.gridScore(cards('7 5 9 7 6 4')), 0 + 11 + 13, 'a vertical pair of 7s cancels its column');
  eq(G.gridScore(cards('Q Q Q Q Q Q')), 0, 'three pairs of queens score 0');
  eq(G.gridScore(cards('2 4 4 3 K 5')), -2 + 3 + 4 + 0 + 4 + 5, 'twos are −2 (not a pair here)');
  eq(G.gridScore(cards('2 5 6 2 8 9')), 0 + 13 + 15, 'a pair of 2s cancels to 0 (classic rule)');
  eq(G.gridScore(cards('K 3 3 K 3 8')), 0 + 0 + 11, 'pair of kings 0, pair of 3s 0');
  eq(G.gridScore(cards('5 5 5 6 6 6')), 11 * 3, 'horizontal equal cards do not cancel (only columns)');
  eq(G.gridScore(cards('* 4 J * 4 J')), 0, 'pairs of jokers, 4s and jacks cancel');
  eq(G.gridScore(cards('* A 3 2 A 9')), -4 + 0 + 12, 'joker + 2 in a column: −4 (different ranks)');
  eq(G.gridScore([c('J'), c('4'), c('4'), c('Q'), c('5'), c('6')]), 20 + 9 + 10, 'J and Q are both 10 but not the same rank: no pair');
  {
    const cells = cards('7 5 9 7 6 4').map((card, i) => ({ card, up: [1, 0, 1, 0, 1, 0][i] }));
    eq(G.visibleScore(cells), 7 + 9 + 6, 'visible score counts face-up cards only');
    cells[3].up = true; eq(G.visibleScore(cells), 0 + 9 + 6, 'visible pair counts once both are up');
    const d = G.swapDeltas(cells, c('9'));
    eq(d[1], null, 'face-down slot → null'); eq(d[0], 16 - 0, 'swapping 9 onto a paired 7 breaks the pair: +16');
    eq(d[2], 0, '9 for 9: no change'); eq(d[4], 3, '9 for the 6: +3');
    eq(G.swapDeltas(cells, c('K'))[4], -6, 'king (0) for the 6: −6');
  }

  /* ---- deal + setup ---- */
  {
    const rng = C.makeRng(11);
    for (const n of [2, 3, 4]) {
      const st = G.newRound({ n }, rng, { round: 0 });
      eq(st.grids.map(g => g.length), new Array(n).fill(6), `${n}p: 6 cards each`); eq(st.discard.length, 1, `${n}p: one card starts the discard pile`);
      eq(st.stock.length, 52 - 6 * n - 1, `${n}p: stock size`); ok(st.grids.every(g => g.every(x => !x.up)), `${n}p: all dealt face down`);
      const ids = [...st.stock, ...st.discard, ...st.grids.flat().map(x => x.card)].map(x => x.id); eq(new Set(ids).size, 52, `${n}p: every card exactly once`);
      eq(st.phase, 'setup', 'starts in setup'); eq(st.turn, 0, 'hole 1 starts at seat 0');
    }
    eq(G.newRound({ n: 3 }, rng, { round: 4 }).start, 1, 'the first player rotates each hole (hole 5 of 3 players → seat 1)');
    eq(G.newRound({ n: 4, jokers: true }, rng).stock.length, 54 - 24 - 1, 'jokers option adds 2 cards');
    // setup: each seat turns 2 cards, in order, then play starts with the first player
    let st = G.newRound({ n: 3 }, rng, { round: 1 }); eq(st.turn, 1, 'hole 2 starts at seat 1');
    eq(G.legalMoves(st, 1).length, 6, 'setup: any of 6 face-down cards'); eq(G.legalMoves(st, 0), [], 'setup: others wait');
    st = G.applyMove(st, 1, { type: 'flip', i: 0 }); eq(st.turn, 1, 'first flip keeps the turn'); eq(G.legalMoves(st, 1).length, 5, 'cannot flip the same card twice');
    st = G.applyMove(st, 1, { type: 'flip', i: 4 }); eq(st.turn, 2, 'after 2 flips the next seat');
    st = G.applyMove(G.applyMove(st, 2, { type: 'flip', i: 1 }), 2, { type: 'flip', i: 2 });
    st = G.applyMove(G.applyMove(st, 0, { type: 'flip', i: 3 }), 0, { type: 'flip', i: 5 });
    eq(st.phase, 'play', 'everyone flipped 2 → play'); eq(st.turn, 1, 'play starts with the hole\'s first player');
    eq(st.grids.map(g => g.filter(x => x.up).length), [2, 2, 2], 'exactly 2 face up each');
    eq(G.legalMoves(st, 1).map(GAME.moveKey), ['d:stock', 'd:discard'], 'a turn starts with draw from stock or discard');
  }

  /* ---- a turn: draw, swap / discard + flip ---- */
  {
    const st = mk({ grids: ['9 9 9 9 9 9', 'A A A A A A'], up: [[1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], stock: '3 4 K', discard: '5 Q' });
    let s = G.applyMove(st, 0, { type: 'draw', from: 'stock' }); eq(G.label(s.held.card), 'K', 'drew the top of the stock'); eq(s.turn, 0, 'drawing keeps the turn'); eq(s.stock.length, 2, 'stock shrinks');
    const lm = G.legalMoves(s, 0).map(GAME.moveKey); eq(lm.filter(k => k.startsWith('swap')).length, 6, 'stock card: swap with any of 6'); eq(lm.filter(k => k.startsWith('discardFlip')).length, 5, 'stock card: or discard and flip one of 5 face-down');
    const a = G.applyMove(s, 0, { type: 'swap', i: 3 }); eq(G.label(a.grids[0][3].card), 'K', 'swapped card goes in face up'); ok(a.grids[0][3].up, 'swapped slot is up');
    eq(G.label(a.discard[a.discard.length - 1]), '9', 'replaced card on the discard pile'); eq(a.turn, 1, 'turn passes'); eq(a.held, null, 'hand empty');
    const b = G.applyMove(s, 0, { type: 'discardFlip', i: 5 }); eq(G.label(b.discard[b.discard.length - 1]), 'K', 'discarded the drawn card'); ok(b.grids[0][5].up, 'and turned a face-down card up'); eq(b.turn, 1, 'turn passes');
    const d = G.applyMove(st, 0, { type: 'draw', from: 'discard' }); eq(G.label(d.held.card), 'Q', 'took the top discard'); eq(d.discard.length, 1, 'discard pile shrinks');
    eq(G.legalMoves(d, 0).map(GAME.moveKey).filter(k => k.startsWith('discardFlip')), [], 'a card taken from the discard must be swapped');
    // stock runs out → discard (except top) reshuffled
    const e = mk({ grids: ['9 9 9 9 9 9', 'A A A A A A'], stock: '', discard: '3 4 5 6 7' });
    eq(G.legalMoves(e, 0).map(GAME.moveKey), ['d:stock', 'd:discard'], 'empty stock can still be drawn (reshuffle)');
    const f = G.applyMove(e, 0, { type: 'draw', from: 'stock' }); eq(f.discard.length, 1, 'top discard stays'); eq(G.label(f.discard[0]), '7', 'the top discard is kept'); eq(f.stock.length + 1, 4, 'the rest became the stock'); eq(f.reshuffles, 1, 'reshuffle counted');
    const h = mk({ grids: ['9 9 9 9 9 9', 'A A A A A A'], stock: '', discard: '3' });
    eq(G.legalMoves(h, 0).map(GAME.moveKey), ['d:discard'], 'no stock and one discard: only the discard');
  }

  /* ---- host-authoritative rejection through cardroom ---- */
  {
    const seats = C.makeSeats({ players: 3, locals: 1, botNames: ['A', 'B'] });
    const m = C.createMatch(GAME, { seats, opts: { n: 3, holes: 3 }, seed: 9 }); m.deal();
    eq(m.scores.length, 3, 'one score column per player');
    const t = m.turn(); ok(!m.act((t + 1) % 3, { type: 'flip', i: 0 }).ok, 'flip out of turn rejected');
    ok(!m.act(t, { type: 'draw', from: 'stock' }).ok, 'drawing during setup rejected'); ok(!m.act(t, { type: 'flip', i: 9 }).ok, 'flip of a slot that does not exist rejected');
    ok(m.act(t, { type: 'flip', i: 0 }).ok, 'legal flip accepted'); ok(!m.act(t, { type: 'flip', i: 0 }).ok, 'flipping a face-up card rejected');
    m.act(t, { type: 'flip', i: 1 }); while (m.state.phase === 'setup') m.botAct(m.turn());
    const p = m.turn(); ok(!m.act(p, { type: 'swap', i: 0 }).ok, 'swap before drawing rejected'); ok(!m.act(p, { type: 'discardFlip', i: 5 }).ok, 'discard before drawing rejected');
    ok(m.act(p, { type: 'draw', from: 'discard' }).ok, 'draw the discard'); ok(!m.act(p, { type: 'draw', from: 'stock' }).ok, 'second draw rejected');
    ok(!m.act(p, { type: 'discardFlip', i: 5 }).ok, 'discarding a card taken from the discard pile rejected'); ok(!m.act(p, null).ok, 'null move rejected');
    ok(m.act(p, { type: 'swap', i: 5 }).ok, 'swap accepted'); eq(m.turn(), (p + 1) % 3, 'next player');
    eq(m.rejected, 9, 'nine rejections counted');
  }

  /* ---- end of the hole: the others get exactly one more turn ---- */
  {
    // seat 0 has 5 up; drawing and flipping the last card goes out; seats 1 and 2 then get one turn each
    const st = mk({ n: 3, grids: ['A 2 3 A 2 3', 'K Q K K Q K', '5 5 5 6 6 6'], up: [[1, 1, 1, 1, 1, 0], [1, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], stock: '9 9 9 9 9 9 9 8', discard: '4' });
    let s = G.applyMove(st, 0, { type: 'draw', from: 'stock' }); s = G.applyMove(s, 0, { type: 'discardFlip', i: 5 });
    eq(s.finisher, 0, 'seat 0 went out'); eq(s.lastLeft, 2, 'two more turns'); eq(s.turn, 1, 'seat 1 next'); eq(s.over, null, 'hole not over yet');
    s = G.applyMove(s, 1, { type: 'draw', from: 'stock' }); s = G.applyMove(s, 1, { type: 'discardFlip', i: 2 }); eq(s.over, null, 'still one more turn'); eq(s.turn, 2, 'seat 2 has its last turn');
    s = G.applyMove(s, 2, { type: 'draw', from: 'discard' }); s = G.applyMove(s, 2, { type: 'swap', i: 0 });
    ok(!!s.over, 'hole over after everyone else had one turn'); eq(G.turnOf(s), null, 'nobody moves after the hole ends');
    ok(s.grids.every(g => g.every(x => x.up)), 'all cards revealed at the end');
    eq(s.over.scores, [0, 0 + 0 + 0, G.gridScore(s.grids[2].map(x => x.card))], 'every grid scored with column pairs');
    eq(s.over.winners, [0, 1], 'tie for lowest: both win the hole'); eq(s.over.tie, true, 'tie flagged');
    // a second player going out during the last turns does not get another turn
    const t = mk({ n: 2, grids: ['K K K K K 5', '3 3 3 3 3 9'], up: [[1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 0]], stock: '9 9 9 9 7' });
    let u = G.applyMove(t, 0, { type: 'draw', from: 'stock' }); u = G.applyMove(u, 0, { type: 'swap', i: 5 }); eq(u.finisher, 0, 'swap into the last face-down card also goes out');
    u = G.applyMove(u, 1, { type: 'draw', from: 'stock' }); u = G.applyMove(u, 1, { type: 'discardFlip', i: 5 }); ok(!!u.over, '2 players: one more turn, then over');
    eq(u.over.scores, [7, 12], 'scores: kings paired + K|7 vs threes paired + 3|9'); eq(u.over.winner, 0, 'lowest wins the hole');
    // a swap into a face-up slot does not go out
    const w = mk({ n: 2, grids: ['K K K K K 5', '3 3 3 3 3 9'], up: [[1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 0]], stock: '9 9 2' });
    let x = G.applyMove(w, 0, { type: 'draw', from: 'stock' }); x = G.applyMove(x, 0, { type: 'swap', i: 0 }); eq(x.finisher, null, 'swapping a face-up card does not go out');
    // friendly guard: hole ends after TURN_CAP turns each
    const y = mk({ n: 2, grids: ['K K K K K 5', '3 3 3 3 3 9'], up: [[1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0]], turns: G.TURN_CAP * 2 - 1, stock: '9 9 2' });
    let z = G.applyMove(y, 0, { type: 'draw', from: 'stock' }); z = G.applyMove(z, 0, { type: 'swap', i: 0 }); eq(z.over && z.over.type, 'limit', 'turn guard ends a stuck hole');
  }

  /* ---- match: 3 or 9 holes, per-seat totals, lowest total wins ---- */
  {
    for (const holes of [3, 9]) {
      const seats = C.makeSeats({ players: 4, locals: 0, botNames: ['A', 'B', 'C', 'D'] });
      const m = C.createMatch(GAME, { seats, opts: { n: 4, holes }, seed: 21 + holes });
      const sum = [0, 0, 0, 0]; let rounds = 0;
      while (m.phase !== 'matchEnd' && rounds < 20) { m.deal(); rounds++; eq(m.state.start, (rounds - 1) % 4, `hole ${rounds}: first player rotates`); let g = 0; while (m.phase === 'turns' && g++ < 2000) m.botAct(m.turn()); m.last.scores.forEach((v, i) => sum[i] += v); }
      eq(rounds, holes, `${holes}-hole match plays exactly ${holes} holes`); eq(m.scores, sum, `${holes} holes: totals are the sum of hole scores`);
      const min = Math.min(...m.scores); eq(m.scores[m.winnerSide], min, `${holes} holes: lowest total wins`); eq(m.winnerSide, m.scores.indexOf(min), 'winner is the first lowest seat'); ok(m.result && Array.isArray(m.result.winners), 'match result lists the winners');
    }
    eq(G.matchOver([10, 4, 4], 9, { holes: 9 }), { winner: 1, winners: [1, 2], tie: true }, 'matchOver: tie on lowest total');
    eq(G.matchOver([10, 4, 4], 8, { holes: 9 }), null, 'matchOver: not before the last hole');
    eq(G.matchOver([-3, 4], 3, { holes: 3 }), { winner: 0, winners: [0], tie: false }, 'matchOver: negative totals are fine');
  }

  /* ---- view hides face-down cards and the stock ---- */
  {
    const st = G.newRound({ n: 3 }, C.makeRng(5));
    const v = G.view(st, 1); ok(!('stockCards' in v) && typeof v.stock === 'number', 'stock is a count'); ok(v.grids.every(g => g.every(x => !x.up && x.card === null)), 'face-down cards carry no value (own grid too)');
    let s = G.applyMove(st, 0, { type: 'flip', i: 2 }); ok(G.view(s, 1).grids[0][2].card, 'face-up cards are visible to everyone');
    s = G.applyMove(G.applyMove(G.applyMove(G.applyMove(G.applyMove(s, 0, { type: 'flip', i: 3 }), 1, { type: 'flip', i: 0 }), 1, { type: 'flip', i: 1 }), 2, { type: 'flip', i: 0 }), 2, { type: 'flip', i: 1 });
    s = G.applyMove(s, 0, { type: 'draw', from: 'stock' });
    ok(G.view(s, 0).held.card, 'the drawer sees the card drawn from the stock'); eq(G.view(s, 1).held.card, null, 'other players do not see a card drawn from the stock');
  }

  /* ---- bots: 500 random simulated holes, never an illegal move, never peek ---- */
  {
    let illegal = 0, rounds = 0, moves = 0, peeks = 0, limits = 0, reshuffles = 0, outs = 0;
    const orig = G.GAME.botMove;
    let liveState = null;
    // the peek check: every card in a bot's view must be public (face up, in the discard pile) or the card it holds
    const game = { ...G.GAME, botMove(v, skill, rng) {
      if ('stockCards' in v || 'hands' in v || Array.isArray(v.stock)) peeks++;
      const allowed = new Set(); const st = liveState;
      st.grids.forEach(g => g.forEach(x => { if (x.up) allowed.add(x.card.id); })); st.discard.forEach(x => allowed.add(x.id)); if (st.held && (st.turn === v.seat || st.held.from === 'discard')) allowed.add(st.held.card.id);
      const seen = []; v.grids.forEach(g => g.forEach(x => { if (x.card) seen.push(x.card.id); if (!x.up && x.card) peeks++; })); v.discard.forEach(x => seen.push(x.id)); if (v.held && v.held.card) seen.push(v.held.card.id);
      for (const id of seen) if (!allowed.has(id)) peeks++;
      return orig(v, skill, rng);
    } };
    for (let r = 0; r < 500; r++) {
      const n = 2 + (r % 3), jokers = r % 4 === 0;
      const seats = C.makeSeats({ players: n, locals: 0, botNames: ['A', 'B', 'C', 'D'] }).map((s, i) => ({ ...s, skill: C.SKILLS[(r + i) % 3] }));
      const m = C.createMatch(game, { seats, opts: { n, jokers, holes: 99 }, seed: 1000 + r });
      m.on('reject', () => illegal++);
      m.deal(); let guard = 0;
      while (m.phase === 'turns' && guard++ < 5000) { const s = m.turn(); liveState = m.state; const res = m.botAct(s); moves++; if (!res.ok) break; }
      ok(m.phase === 'roundEnd', `hole ${r} finished (n=${n})`);
      const st = m.state; if (st.over.type === 'limit') limits++; else outs++; reshuffles += st.reshuffles || 0;
      // conservation: stock + discard + grids = deck size; every card once
      const ids = [...st.stock, ...st.discard, ...st.grids.flat().map(x => x.card)].map(x => x.id);
      if (ids.length !== (jokers ? 54 : 52) || new Set(ids).size !== ids.length) ok(false, 'cards conserved in hole ' + r);
      eq(st.over.scores, st.grids.map(g => G.gridScore(g.map(x => x.card))), `hole ${r} scored from the final grids`);
      rounds++;
    }
    eq(illegal, 0, 'bots made no illegal move in 500 holes'); eq(peeks, 0, 'bots never saw a hidden card or the stock order');
    console.log(`sim: ${rounds} holes, ${moves} bot moves, ${outs} went out, ${limits} turn-guard endings, ${reshuffles} reshuffles`);
    ok(limits <= 5, 'the turn guard almost never ends a hole');
    // skill check: Sharp beats Chill head to head (lower hole score) more often than not
    let sharpWins = 0, games = 0, avg = { chill: 0, normal: 0, sharp: 0 }, cnt = { chill: 0, normal: 0, sharp: 0 };
    for (let r = 0; r < 300; r++) {
      const sk = [['sharp', 'chill'], ['chill', 'sharp'], ['normal', 'chill'], ['chill', 'normal'], ['sharp', 'normal'], ['normal', 'sharp']][r % 6];
      const seats = [{ i: 0, kind: 'bot', skill: sk[0] }, { i: 1, kind: 'bot', skill: sk[1] }];
      const m = C.createMatch(G.GAME, { seats, opts: { n: 2, holes: 99 }, seed: 5000 + r }); m.deal();
      let g = 0; while (m.phase === 'turns' && g++ < 5000) m.botAct(m.turn());
      m.last.scores.forEach((v, i) => { avg[sk[i]] += v; cnt[sk[i]]++; });
      if (sk.includes('sharp') && sk.includes('chill') && !m.last.tie) { games++; if (sk[m.last.winner] === 'sharp') sharpWins++; }
    }
    for (const k in avg) avg[k] = +(avg[k] / cnt[k]).toFixed(1);
    console.log(`sharp vs chill: sharp won ${sharpWins}/${games}; average hole score`, JSON.stringify(avg));
    ok(sharpWins / games > .6, 'sharp bots beat chill bots most of the time'); ok(avg.sharp < avg.normal && avg.normal < avg.chill, 'skill order: sharp < normal < chill average score');
  }


  /* ---- online on separate screens: host match + mirrorMatch guests through a fake room (engine/cardroom.js) ---- */
  {
    let leaks = 0, legalDiff = 0, rounds = 0, guestMoves = 0, reject = 0;
    for (let r = 0; r < 40; r++) {
      const n = 2 + (r % 3), seats = Array.from({ length: n }, (_, i) => i === 0 ? { i, kind: 'bot', skill: 'normal' } : { i, kind: 'online', slot: i, name: 'G' + i });
      const m = C.createMatch(G.GAME, { seats, opts: { n, holes: 99 }, seed: 700 + r });
      const guests = {}, h = {}; const room = { send(slot, kind, data) { const g = guests[slot]; if (kind === 'view') g.apply(data); else if (kind === 'rej') g.reject(data); }, on(k, f) { h[k] = f; }, onJoin() { }, start() { }, broadcast() { } };
      for (let i = 1; i < n; i++) guests[i] = C.mirrorMatch(G.GAME, { seats, opts: m.opts, seat: i, send: move => h.act({ slot: i }, { move }) });
      C.onlineHost(room, m); m.deal();
      let g = 0; while (m.phase === 'turns' && g++ < 5000) {
        const s = m.turn(); if (s === 0) { m.botAct(0); continue; }
        const gm = guests[s], st = gm.state;
        st.grids.forEach(gr => gr.forEach(c => { if (!c.up && c.card) leaks++; })); if (st.stock.some(c => c)) leaks++; if (st.seed) leaks++;
        for (let o = 1; o < n; o++) if (o !== s) { const os = guests[o].state; if (os.held && os.held.from === 'stock' && os.held.card) leaks++; }
        if (JSON.stringify(gm.legal(s).map(G.moveKey)) !== JSON.stringify(m.legal(s).map(G.moveKey))) legalDiff++;
        // a move the host would refuse is refused on the guest with the same reason
        const bad = st.held ? { type: 'draw', from: 'stock' } : { type: 'swap', i: 0 }; if (gm.act(s, bad).reason === 'illegal') reject++;
        gm.act(s, G.botMove(gm.view(s), 'normal', Math.random)); guestMoves++;
      }
      if (m.phase !== 'turns') { rounds++; for (let i = 1; i < n; i++) if (guests[i].phase !== m.phase || JSON.stringify(guests[i].scores) !== JSON.stringify(m.scores)) leaks += 100; }
    }
    eq(leaks, 0, 'online guests never see a face-down card, the stock order or another player\'s stock draw');
    eq(legalDiff, 0, 'a guest computes the same legal moves from its redacted state as the host');
    ok(rounds === 40 && guestMoves > 300 && reject > 300, `40 online holes finished through the host (${guestMoves} guest moves, ${reject} bad moves refused)`);
  }

  console.log(`${passes} passed, ${fails} failed`);
  console.log(fails ? 'RULES_FAILED' : 'RULES_OK');
  process.exitCode = fails ? 1 : 0;
})();
