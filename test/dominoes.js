// Dominoes headless test (games/dominoes.html).
// Title → solo vs 3 bots (teams, Chill hints): real taps on tiles, an illegal tap is rejected, the both-ends picker,
// keyboard play → a full match to the results card (profile XP + plays) → Spanish Draw game with 2 players to results →
// pass-and-play privacy screen (hand hidden between players) → host rejects moves out of turn.
// usage: PORT=8701 node test/run.js dominoes test/dominoes.js   (add W=390 H=844 for portrait)
module.exports = async (p, shot) => {
  const log = (k, v) => console.log(k, typeof v === 'string' ? v : JSON.stringify(v));
  const fail = m => { console.error('FAIL ' + m); process.exitCode = 1; return p.evaluate(x => console.error('TEST FAIL ' + x), m); };
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const run = (n, o) => p.evaluate(({ n, o }) => window.__GAME.run(n, 1 / 30, o || {}), { n, o });
  const g = (f, a) => p.evaluate(f, a);
  // wait (simulating) until it is seat s's turn and nothing is animating
  const untilTurn = async (s, max = 900) => g(({ s, max }) => { const G = window.__GAME; for (let i = 0; i < max; i++) { if (G.m.phase !== 'turns') return false; if (G.m.turn() === s && !document.querySelector('.dm-card')) return true; G.update(1 / 30); } return false; }, { s, max });

  await p.evaluate(() => { localStorage.removeItem('inoa.dominoes'); const k = 'inoa.profile'; const pr = JSON.parse(localStorage.getItem(k) || '{}'); pr.lang = 'en'; pr.voice = false; localStorage.setItem(k, JSON.stringify(pr)); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await settle(600);
  await shot('title');
  const xp0 = await g(() => (JSON.parse(localStorage.getItem('inoa.profile') || '{}').xp) || 0);

  /* ---------- solo vs 3 bots, teams, Chill (hints), first to 50 ---------- */
  await g(() => { document.querySelector('#pN [data-n="4"]').click(); });
  await g(() => { document.querySelector('#pT [data-t="1"]').click(); document.querySelector('#pM [data-m=block]').click(); document.querySelector('#pS [data-s=chill]').click(); document.querySelector('#pG [data-g="50"]').click(); document.querySelector('#pH [data-h="1"]').click(); });
  await g(() => { window.__GAME.fast(true); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.G && window.__GAME.phase === 'turns', null, { timeout: 20000 });
  log('seats', await g(() => window.__GAME.G.seats.map(s => `${s.kind}:${s.name}`).join(',')));
  log('hands', await g(() => window.__GAME.state.hands.map(h => h.length)));
  // seat 0 must see 7 tiles in the tray and the 3 others only as counts
  const tray = await g(() => ({ tiles: document.querySelectorAll('#hand .dm-tile').length, seats: document.querySelectorAll('.dm-seat').length }));
  log('tray', tray); if (tray.tiles !== 7 || tray.seats !== 3) await fail('tray should show 7 tiles and 3 opponent chips');
  await settle(500); await shot('start');

  // real taps: play up to 3 of our turns with mouse clicks / touch-like taps
  let taps = 0, bothEnds = 0, rejectedTap = false;
  for (let k = 0; k < 6 && taps < 3; k++) {
    if (!(await untilTurn(0))) break;
    await settle(250);
    const info = await g(() => { const G = window.__GAME, st = G.state, h = st.hands[0]; return { ok: [...document.querySelectorAll('#hand .dm-tile')].map(b => b.classList.contains('ok')), canPlay: G.legal(0).some(m => m.type === 'play'), act: document.querySelector('#acts button')?.dataset.a || null }; });
    if (!info.canPlay) { if (info.act) await p.click(`#acts [data-a=${info.act}]`); else await run(60); continue; }
    // once: tap a tile that does not fit → host rejects, table unchanged
    const bad = info.ok.indexOf(false);
    if (!rejectedTap && bad >= 0) {
      const before = await g(() => ({ line: window.__GAME.state.line.length, rej: window.__GAME.m.rejected }));
      await p.click(`#hand .dm-tile >> nth=${bad}`, { force: true }); await settle(150);
      const after = await g(() => ({ line: window.__GAME.state.line.length, rej: window.__GAME.m.rejected, turn: window.__GAME.m.turn() }));
      log('illegal tap', { before, after }); if (after.line !== before.line || after.rej !== before.rej + 1 || after.turn !== 0) await fail('illegal tap should be rejected without changing the table'); rejectedTap = true;
      await shot('rejected');
    }
    const good = info.ok.indexOf(true);
    await p.click(`#hand .dm-tile >> nth=${good}`, { force: true }); await settle(150);
    if (await g(() => !document.getElementById('endPick').hidden)) { bothEnds++; await shot('both_ends'); await p.click('#endPick [data-e=R]', { force: true }); await settle(100); }
    taps++;
    log('tap ' + taps, await g(() => ({ line: window.__GAME.state.line.length, hand: window.__GAME.state.hands[0].length, turn: window.__GAME.m.turn() })));
  }
  if (!taps) await fail('no tile was played by tapping');
  log('taps', { taps, bothEnds, rejectedTap });
  // keyboard: arrows select, Space plays (if it fits one end) — one turn
  if (await untilTurn(0)) {
    const kb = await g(() => { const G = window.__GAME, st = G.state; const i = st.hands[0].findIndex(t => window.__GAME.D.fits(st, t).length === 1 && !st.forced); return i; });
    if (kb >= 0) { const n0 = await g(() => window.__GAME.state.hands[0].length); for (let i = 0; i <= kb; i++) { await p.keyboard.down('ArrowRight'); await g(() => window.__GAME.update(1 / 30)); await p.keyboard.up('ArrowRight'); await g(() => window.__GAME.update(1 / 30)); } await p.keyboard.down('Space'); await g(() => window.__GAME.update(1 / 30)); await p.keyboard.up('Space'); await g(() => window.__GAME.update(1 / 30)); const n1 = await g(() => window.__GAME.state.hands[0].length); log('keyboard play', { n0, n1 }); if (n1 !== n0 - 1) await fail('keyboard play did not play a tile'); }
  }
  await settle(300); await shot('midround');
  // finish the match on autopilot (seat 0 plays like a Sharp bot), stopping at the first round card for a screenshot
  await g(() => window.__GAME.auto(true));
  const ph1 = await run(4000); log('after autopilot', ph1);
  await settle(400); await shot('round_card');
  log('round', await g(() => { const o = window.__GAME.G.lastRound; return { type: o.type, winner: o.winner, points: o.points, scores: window.__GAME.m.scores }; }));
  const ph2 = await run(40000, { skipCards: true }); log('match', { phase: ph2, scores: await g(() => window.__GAME.m.scores), rounds: await g(() => window.__GAME.G.stats.rounds), botMoves: await g(() => window.__GAME.m.log.filter(l => l.from === 'bot').length), rejected: await g(() => window.__GAME.m.rejected) });
  if (ph2 !== 'matchEnd') await fail('match did not finish');
  await g(() => window.__GAME.next()); await settle(500);
  await shot('results');
  const res = await g(() => ({ card: !!document.querySelector('.ig-results'), title: document.querySelector('.ig-results h2')?.textContent, plays: JSON.parse(localStorage.getItem('inoa.profile')).games.dominoes?.plays, xp: JSON.parse(localStorage.getItem('inoa.profile')).xp, save: JSON.parse(localStorage.getItem('inoa.dominoes')) }));
  log('results', res); if (!res.card || res.plays !== 1 || !(res.xp > xp0)) await fail('results card / profile XP missing');
  if (!res.save || res.save.played !== 1) await fail('save not written');
  if (JSON.stringify(res.save).length > 2000) await fail('save too big');

  /* ---------- Spanish, Draw mode, 2 players ---------- */
  await p.click('.ig-results [data-a=again]'); await settle(400);
  await g(() => document.querySelector('#pL [data-l=es]').click()); await settle(300);
  const esTitle = await g(() => ({ h1: document.querySelector('.ig-title h1').textContent, play: document.querySelector('.ig-title [data-a=play]').textContent, lang: document.documentElement.lang }));
  log('es title', esTitle); if (esTitle.h1 !== 'Dominó') await fail('Spanish title');
  await shot('title_es');
  await g(() => { document.querySelector('#pN [data-n="2"]').click(); });
  await g(() => { document.querySelector('#pM [data-m=draw]').click(); document.querySelector('#pS [data-s=sharp]').click(); document.querySelector('#pG [data-g="50"]').click(); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.phase === 'turns', null, { timeout: 20000 });
  log('es draw', await g(() => ({ hands: window.__GAME.state.hands.map(h => h.length), bone: window.__GAME.state.boneyard.length, who: document.getElementById('who').textContent })));
  // find a turn of ours where we must draw (or just play), to see the Draw button in Spanish
  let sawDraw = false;
  for (let k = 0; k < 40 && !sawDraw; k++) {
    if (await g(() => window.__GAME.phase === 'roundEnd')) await g(() => { window.__GAME.run(80); window.__GAME.next(); });
    if (!(await untilTurn(0, 1200))) continue;
    const lm = await g(() => window.__GAME.legal(0)[0].type);
    if (lm === 'draw') { await settle(300); await shot('es_draw'); const txt = await g(() => document.querySelector('#acts button').textContent); log('draw button', txt); if (!/Robar/.test(txt)) await fail('Spanish draw button'); await p.click('#acts [data-a=draw]'); sawDraw = true; }
    else await g(() => { const G = window.__GAME, m = G.legal(0).find(x => x.type === 'play'); G.act(0, m); });
  }
  log('saw draw', sawDraw);
  await settle(300); await shot('es_play');
  await g(() => window.__GAME.auto(true));
  const ph3 = await run(60000, { skipCards: true }); log('es match', { phase: ph3, scores: await g(() => window.__GAME.m.scores) });
  await settle(300); await shot('es_round');
  await g(() => window.__GAME.next()); await settle(500);
  const res2 = await g(() => ({ card: !!document.querySelector('.ig-results'), title: document.querySelector('.ig-results h2')?.textContent, again: document.querySelector('.ig-results [data-a=again]')?.textContent, plays: JSON.parse(localStorage.getItem('inoa.profile')).games.dominoes?.plays }));
  log('es results', res2); if (!res2.card || res2.plays !== 2 || !/Otra/.test(res2.again || '')) await fail('Spanish results');
  await shot('es_results');
  await p.click('.ig-results [data-a=again]'); await settle(300);
  await g(() => document.querySelector('#pL [data-l=en]').click()); await settle(300);

  /* ---------- pass-and-play: 2 people + 1 bot ---------- */
  await g(() => { document.querySelector('#pN [data-n="3"]').click(); });
  await g(() => { document.querySelector('#pM [data-m=block]').click(); document.querySelector('#pH [data-h="2"]').click(); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.phase === 'turns', null, { timeout: 20000 });
  log('hot-seat seats', await g(() => window.__GAME.G.seats.map(s => `${s.kind}:${s.name}`).join(',')));
  let privacyOk = true, handoffs = 0;
  for (let k = 0; k < 8 && handoffs < 3; k++) {
    // simulate until a privacy card appears (a local player's turn)
    const t = await g(() => { const G = window.__GAME; for (let i = 0; i < 900; i++) { if (G.m.phase !== 'turns') return null; if (document.querySelector('.dm-card [data-a=show]')) return G.m.turn(); G.update(1 / 30); } return null; });
    if (t == null) break;
    handoffs++;
    const hidden = await g(() => ({ tiles: document.querySelectorAll('#hand .dm-tile').length, text: document.getElementById('who').textContent, card: document.querySelector('.dm-card h2').textContent }));
    log('handoff ' + handoffs, { seat: t, ...hidden }); if (hidden.tiles !== 0) { privacyOk = false; await fail('tiles visible behind the privacy screen'); }
    if (handoffs === 1) { await settle(300); await shot('handoff'); }
    await p.click('.dm-card [data-a=show]'); await settle(150);
    const shown = await g(s => { const G = window.__GAME; return { tiles: [...document.querySelectorAll('#hand .dm-tile')].map(b => b.dataset.k).join(','), mine: G.state.hands[s].map(t => G.D.key(t)).join(',') }; }, t);
    if (shown.tiles !== shown.mine) { privacyOk = false; await fail('tray does not show the current player\'s own hand'); }
    if (handoffs === 1) { await shot('hotseat_hand'); const other = await g(s => { const G = window.__GAME; const o = G.G.seats.findIndex((x, i) => i !== s && x.kind === 'local'); const mv = G.state.hands[o][0]; return G.act(o, { type: 'play', tile: mv, end: 'L' }, 'local').reason; }, t); log('out-of-turn move', other); if (other !== 'not-your-turn') await fail('host should reject a move out of turn'); }
    // play our first legal move by clicking
    const lm = await g(s => window.__GAME.legal(s), t);
    if (lm[0].type === 'play') { const k2 = await g(({ s, m }) => window.__GAME.state.hands[s].findIndex(x => window.__GAME.D.key(x) === window.__GAME.D.key(m.tile)), { s: t, m: lm[0] }); await p.click(`#hand .dm-tile >> nth=${k2}`, { force: true }); if (await g(() => !document.getElementById('endPick').hidden)) await p.click('#endPick [data-e=L]', { force: true }); }
    else await g(s => window.__GAME.act(s, window.__GAME.legal(s)[0]), t);
    await settle(100);
  }
  log('hot-seat', { handoffs, privacyOk }); if (handoffs < 2) await fail('expected at least two privacy screens');
  // abandon to the title cleanly
  await g(() => window.__GAME.title()); await settle(300);
  await shot('title_end');
};
