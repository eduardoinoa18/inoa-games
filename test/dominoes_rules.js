// Unit tests for the Dominoes rules (games/dominoes-rules.js) and the shared Card Room match controller (engine/cardroom.js).
// usage: node test/dominoes_rules.js   (plain Node, no framework, no browser)
process.removeAllListeners('warning'); // the ES modules are plain .js in a typeless package; Node re-parses them (harmless warning)
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

(async () => {
  const D = await import('../games/dominoes-rules.js');
  const C = await import('../engine/cardroom.js');
  const { GAME } = D;
  // a hand-built state (helper): hands given, line given as [[a,b],...] in order left→right
  const mk = ({ n = 4, mode = 'block', teams = false, hands, line = [], turn = 0, boneyard = [], capicua = false, countAll = false, leader = 0 }) => {
    const st = { n, mode, teams, capicua, countAll, hands: hands.map(h => h.map(t => t.slice())), boneyard: boneyard.map(t => t.slice()), sleeping: 0, line: [], ends: null, turn, leader, forced: null, passes: 0, passLog: [], history: [], over: null };
    if (line.length) { st.line = line.map(t => ({ t, end: 'R', inner: t[0], outer: t[1] })); st.ends = [line[0][0], line[line.length - 1][1]]; }
    return st;
  };

  /* ---- set + deal ---- */
  eq(D.TILES.length, 28, 'double-six has 28 tiles');
  eq(D.TILES.reduce((s, t) => s + D.pips(t), 0), 168, 'total pips in a double-six set');
  {
    const rng = C.makeRng(7);
    const b4 = D.newRound({ n: 4, mode: 'block' }, rng); eq(b4.hands.map(h => h.length), [7, 7, 7, 7], 'block 4p deals 7 each'); eq(b4.boneyard.length, 0, 'block has no boneyard to draw from');
    const b3 = D.newRound({ n: 3, mode: 'block' }, rng); eq(b3.sleeping, 7, 'block 3p leaves 7 sleeping tiles');
    const d4 = D.newRound({ n: 4, mode: 'draw' }, rng); eq(d4.hands.map(h => h.length), [5, 5, 5, 5], 'draw 4p deals 5 each'); eq(d4.boneyard.length, 8, 'draw 4p boneyard 8');
    const d2 = D.newRound({ n: 2, mode: 'draw' }, rng); eq(d2.hands.map(h => h.length), [7, 7], 'draw 2p deals 7 each'); eq(d2.boneyard.length, 14, 'draw 2p boneyard 14');
    // all tiles distinct
    const all = [...b4.hands.flat()].map(D.key); eq(new Set(all).size, 28, 'block 4p deals every tile once');
    // the 6-6 holder opens with it in round one
    const holder = b4.hands.findIndex(h => h.some(t => D.key(t) === '6-6')); eq(b4.turn, holder, 'double six holder opens'); eq(D.key(b4.forced), '6-6', 'opening tile is forced to 6-6');
    const lm = D.legalMoves(b4, holder); eq(lm.length, 1, 'only the forced opener is legal'); eq(D.key(lm[0].tile), '6-6', 'forced opener is 6-6');
    eq(D.legalMoves(b4, (holder + 1) % 4), [], 'other seats have no moves out of turn');
    const later = D.newRound({ n: 4, mode: 'block' }, rng, { leader: 2 }); eq(later.turn, 2, 'later rounds: previous winner leads'); eq(later.forced, null, 'later rounds: lead with any tile'); eq(D.legalMoves(later, 2).length, 7, 'leader may open with any of 7 tiles');
  }

  /* ---- legal moves ---- */
  {
    const st = mk({ hands: [[[6, 4], [4, 2], [1, 1], [0, 3]], [[5, 5]], [[2, 2]], [[3, 3]]], line: [[4, 6], [6, 2]] }); // ends 4 … 2
    const lm = D.legalMoves(st, 0).map(GAME.moveKey).sort();
    eq(lm, ['p:2-4:L', 'p:2-4:R', 'p:4-6:L'].sort(), 'tiles that match an end; 4-2 fits both ends');
    eq(D.fits(st, [4, 2]), ['L', 'R'], 'fits() reports both ends');
    eq(D.fits(st, [1, 1]), [], 'fits() empty for a non-matching tile');
    const st2 = mk({ hands: [[[3, 5], [1, 1]], [[0, 0]], [[0, 1]], [[0, 2]]], line: [[3, 4], [4, 3]] }); // ends 3 … 3
    eq(D.legalMoves(st2, 0).map(GAME.moveKey), ['p:3-5:L'], 'equal ends list one placement');
    const st3 = mk({ hands: [[[1, 1]], [[0, 0]], [[0, 1]], [[0, 2]]], line: [[4, 6]] });
    eq(D.legalMoves(st3, 0), [{ type: 'pass' }], 'block mode: no tile → pass');
    const st4 = mk({ mode: 'draw', hands: [[[1, 1]], [[0, 0]], [[0, 1]], [[0, 2]]], line: [[4, 6]], boneyard: [[5, 5], [6, 3]] });
    eq(D.legalMoves(st4, 0), [{ type: 'draw' }], 'draw mode: no tile + boneyard → draw');
    const s5 = D.applyMove(st4, 0, { type: 'draw' }); eq(s5.turn, 0, 'drawing keeps the turn'); eq(s5.hands[0].length, 2, 'drew one tile'); eq(D.legalMoves(s5, 0).map(GAME.moveKey), ['p:3-6:R'], 'the drawn 6-3 is playable on the 6 end');
    const st6 = mk({ mode: 'draw', hands: [[[1, 1]], [[0, 0]], [[0, 1]], [[0, 2]]], line: [[4, 6]], boneyard: [] });
    eq(D.legalMoves(st6, 0), [{ type: 'pass' }], 'draw mode, empty boneyard → pass');
  }

  /* ---- play + host-authoritative rejection ---- */
  {
    const seats = C.makeSeats({ players: 4, locals: 1, skill: 'normal', botNames: ['A', 'B', 'C'] });
    eq(seats.map(s => s.kind), ['local', 'bot', 'bot', 'bot'], 'makeSeats: 1 local + 3 bots');
    const ph = C.makeSeats({ players: 4, locals: 1, phones: [{ slot: 1, name: 'Ana' }, { slot: 2, name: 'Leo' }] });
    eq(ph.map(s => s.kind + (s.slot || '')), ['local', 'phone1', 'phone2', 'bot'], 'makeSeats: phones take the seats after locals');
    const m = C.createMatch(GAME, { seats, opts: { n: 4, mode: 'block', target: 100 }, seed: 11 }); m.deal();
    const t = m.turn(), other = (t + 1) % 4;
    ok(!m.act(other, m.legal(t)[0]).ok, 'move out of turn rejected');
    const notMine = m.state.hands[other][0]; ok(!m.act(t, { type: 'play', tile: notMine, end: 'L' }).ok, 'playing a tile you do not hold is rejected');
    ok(!m.act(t, { type: 'pass' }).ok, 'passing while you can play is rejected');
    ok(!m.act(t, { type: 'draw' }).ok, 'drawing in block mode is rejected');
    ok(!m.act(t, null).ok, 'null move rejected');
    eq(m.rejected, 5, 'five rejections counted'); eq(m.state.line.length, 0, 'rejected moves never change the table');
    ok(m.act(t, m.legal(t)[0]).ok, 'the legal opener is accepted'); eq(m.state.line.length, 1, 'tile on the table');
    // a tile that fits neither end
    const st = mk({ hands: [[[1, 1], [6, 5]], [[0, 0]], [[0, 1]], [[0, 2]]], line: [[4, 6]] });
    const mm = C.createMatch(GAME, { seats, opts: { n: 4 } }); mm.state = st; mm.phase = 'turns';
    ok(!mm.act(0, { type: 'play', tile: [1, 1], end: 'L' }).ok, 'tile that does not match is rejected');
    ok(!mm.act(0, { type: 'play', tile: [6, 5], end: 'L' }).ok, 'tile on the wrong end is rejected');
    ok(mm.act(0, { type: 'play', tile: [5, 6], end: 'R' }).ok, 'tile on the matching end accepted (either orientation)');
    eq(mm.state.ends, [4, 5], 'ends update to the outer number');
  }

  /* ---- domino scoring ---- */
  {
    const st = mk({ hands: [[[6, 2]], [[5, 5], [1, 0]], [[3, 3]], [[6, 6], [4, 1]]], line: [[2, 4]] }); // ends 2 … 4
    const s = D.applyMove(st, 0, { type: 'play', tile: [6, 2], end: 'L' });
    eq(s.over.type, 'domino', 'last tile = domino'); eq(s.over.winner, 0, 'seat 0 dominoes'); eq(s.over.points, 11 + 6 + 17, 'solo: winner scores every other hand');
    const t = mk({ teams: true, hands: [[[6, 2]], [[5, 5], [1, 0]], [[3, 3]], [[6, 6], [4, 1]]], line: [[2, 4]] });
    const s2 = D.applyMove(t, 0, { type: 'play', tile: [6, 2], end: 'L' });
    eq(s2.over.side, 0, 'teams: seats 0+2 win'); eq(s2.over.points, 11 + 17, 'teams: score the two opponents (partner not counted)');
    const t2 = mk({ teams: true, countAll: true, hands: [[[6, 2]], [[5, 5], [1, 0]], [[3, 3]], [[6, 6], [4, 1]]], line: [[2, 4]] });
    eq(D.applyMove(t2, 0, { type: 'play', tile: [6, 2], end: 'L' }).over.points, 11 + 17 + 6, 'teams + countAll: partner tiles count too');
    // capicúa: domino tile fits both ends with different numbers
    const c = mk({ capicua: true, hands: [[[2, 4]], [[5, 5]], [[3, 3]], [[1, 1]]], line: [[2, 6], [6, 4]] });
    const s3 = D.applyMove(c, 0, { type: 'play', tile: [2, 4], end: 'R' }); eq(s3.over.capicua, true, 'capicúa detected'); eq(s3.over.points, 10 + 6 + 2 + D.CAPICUA_BONUS, 'capicúa adds the bonus when enabled');
    const c2 = mk({ capicua: false, hands: [[[2, 4]], [[5, 5]], [[3, 3]], [[1, 1]]], line: [[2, 6], [6, 4]] });
    eq(D.applyMove(c2, 0, { type: 'play', tile: [2, 4], end: 'R' }).over.points, 18, 'capicúa off: no bonus');
    const c3 = mk({ capicua: true, hands: [[[4, 4]], [[5, 5]], [[3, 3]], [[1, 1]]], line: [[4, 6], [6, 4]] });
    eq(D.applyMove(c3, 0, { type: 'play', tile: [4, 4], end: 'L' }).over.capicua, false, 'a double is never a capicúa');
  }

  /* ---- blocked games ---- */
  {
    // everyone passes: seat 2 has the fewest pips
    const st = mk({ hands: [[[1, 1], [0, 3]], [[5, 5]], [[0, 1]], [[3, 3]]], line: [[4, 6]] });
    let s = st; for (let i = 0; i < 4; i++) { eq(D.legalMoves(s, s.turn), [{ type: 'pass' }], 'blocked: seat ' + s.turn + ' must pass'); s = D.applyMove(s, s.turn, { type: 'pass' }); }
    eq(s.over.type, 'blocked', 'four passes in a row = blocked'); eq(s.over.winner, 2, 'lowest pips wins a blocked round'); eq(s.over.points, 5 + 10 + 6, 'blocked winner scores the losers\' pips'); eq(s.over.nextLeader, 2, 'blocked winner leads next');
    // tie for lowest → nobody scores, lead moves on
    const t = mk({ leader: 1, hands: [[[1, 1]], [[0, 2]], [[5, 5]], [[3, 3]]], line: [[4, 6]] });
    let u = t; for (let i = 0; i < 4; i++) u = D.applyMove(u, u.turn, { type: 'pass' });
    eq(u.over.tie, true, 'tie for fewest pips'); eq(u.over.points, 0, 'tied blocked round scores nothing'); eq(u.over.side, null, 'tied blocked round has no winning side'); eq(u.over.nextLeader, 2, 'after a tie the lead passes to the next seat');
    // teams compare combined pips
    const tm = mk({ teams: true, hands: [[[1, 1]], [[0, 1]], [[6, 6]], [[0, 2]]], line: [[4, 5]] }); // team A 2+12=14, team B 1+2=3
    let v = tm; for (let i = 0; i < 4; i++) v = D.applyMove(v, v.turn, { type: 'pass' });
    eq(v.over.side, 1, 'teams: lower combined pips wins the blocked round'); eq(v.over.points, 14, 'teams: score the other team\'s pips'); eq(v.over.winner, 1, 'teams: the lighter partner leads next');
    // a play resets the pass counter
    const r = mk({ hands: [[[1, 1]], [[6, 2]], [[0, 0]], [[0, 0]]], line: [[4, 6]] });
    let w = D.applyMove(r, 0, { type: 'pass' }); w = D.applyMove(w, 1, { type: 'play', tile: [6, 2], end: 'R' }); eq(w.passes, 0, 'a play resets the pass count');
  }

  /* ---- match scoring to the target (solo + teams) ---- */
  {
    const seats = C.makeSeats({ players: 4, locals: 0, skill: 'sharp', botNames: ['A', 'B', 'C', 'D'] });
    const m = C.createMatch(GAME, { seats, opts: { n: 4, mode: 'block', teams: true, target: 100 }, seed: 3 });
    eq(m.scores.length, 2, 'teams: two score columns');
    let rounds = 0; while (m.phase !== 'matchEnd' && rounds < 60) { m.deal(); rounds++; let g = 0; while (m.phase === 'turns' && g++ < 200) m.botAct(m.turn()); }
    eq(m.phase, 'matchEnd', 'team match reaches the target'); ok(m.scores[m.winnerSide] >= 100, 'winning team has ≥ 100'); ok(m.scores[1 - m.winnerSide] < 100, 'losing team below target');
    const s4 = C.createMatch(GAME, { seats: C.makeSeats({ players: 3, locals: 0, botNames: ['A', 'B', 'C'] }), opts: { n: 3, mode: 'draw', target: 50 }, seed: 5 });
    eq(s4.scores.length, 3, 'solo: one score column per player');
  }

  /* ---- bots: 500 random simulated rounds, never an illegal move, never peek ---- */
  {
    let illegal = 0, rounds = 0, moves = 0, peeks = 0, dominoes = 0, blocked = 0, ties = 0;
    const configs = [];
    for (const n of [2, 3, 4]) for (const mode of ['draw', 'block']) for (const teams of n === 4 ? [false, true] : [false]) configs.push({ n, mode, teams });
    const orig = D.GAME.botMove;
    const game = { ...D.GAME, botMove(v, skill, rng) { if ('hands' in v || 'boneyardTiles' in v) peeks++; if (v.hand.length !== v.counts[v.seat]) peeks++; return orig(v, skill, rng); } };
    for (let r = 0; r < 500; r++) {
      const cfg = configs[r % configs.length], skills = C.SKILLS;
      const seats = C.makeSeats({ players: cfg.n, locals: 0, botNames: ['A', 'B', 'C', 'D'] }).map((s, i) => ({ ...s, skill: skills[(r + i) % 3] }));
      const m = C.createMatch(game, { seats, opts: { ...cfg, target: 9999, capicua: r % 2 === 0 }, seed: 1000 + r });
      m.on('reject', () => illegal++);
      m.deal(); let guard = 0;
      while (m.phase === 'turns' && guard++ < 400) { const s = m.turn(); const res = m.botAct(s); moves++; if (!res.ok) break; }
      ok(m.phase === 'roundEnd', `round ${r} finished (${JSON.stringify(cfg)})`);
      const o = m.last; if (o.type === 'domino') dominoes++; else { blocked++; if (o.tie) ties++; }
      // conservation: line + hands + boneyard + sleeping = 28
      const total = m.state.line.length + m.state.hands.flat().length + m.state.boneyard.length + m.state.sleeping; if (total !== 28) ok(false, 'tile count conserved in round ' + r);
      rounds++;
    }
    eq(illegal, 0, 'bots made no illegal move in 500 rounds'); eq(peeks, 0, 'bots only saw their own view');
    console.log(`sim: ${rounds} rounds, ${moves} bot moves, ${dominoes} dominoes, ${blocked} blocked (${ties} ties)`);
    // skill check: sharp should beat chill more often than not in 1v1 block
    let sharpWins = 0, games = 0;
    for (let r = 0; r < 300; r++) {
      const seats = [{ i: 0, kind: 'bot', skill: r % 2 ? 'sharp' : 'chill' }, { i: 1, kind: 'bot', skill: r % 2 ? 'chill' : 'sharp' }];
      const m = C.createMatch(D.GAME, { seats, opts: { n: 2, mode: 'draw', target: 9999 }, seed: 5000 + r }); m.deal();
      let g = 0; while (m.phase === 'turns' && g++ < 400) m.botAct(m.turn());
      if (m.last.side != null) { games++; if (seats[m.last.side].skill === 'sharp') sharpWins++; }
    }
    console.log(`sharp vs chill (2p draw): sharp won ${sharpWins}/${games}`);
    ok(sharpWins / games > .5, 'sharp bots beat chill bots more than half the time');
  }

  /* ---- view hides other hands ---- */
  {
    const st = D.newRound({ n: 4, mode: 'draw' }, C.makeRng(2));
    const v = D.view(st, 1); ok(!('hands' in v), 'view has no hands field'); eq(v.hand.length, 5, 'view shows own hand'); eq(v.counts, [5, 5, 5, 5], 'view shows tile counts'); eq(typeof v.boneyard, 'number', 'boneyard is a count');
  }

  console.log(`${passes} passed, ${fails} failed`);
  console.log(fails ? 'RULES_FAILED' : 'RULES_OK');
  process.exitCode = fails ? 1 : 0;
})();
