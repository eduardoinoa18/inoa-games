// Six-Card Golf headless test (games/golf.html).
// Title → solo vs 3 bots (Chill = hints): real taps to turn 2 cards up, a swap before drawing is rejected, draw + swap,
// draw + discard + flip (a face-up pick is rejected), keyboard play → a 3-hole match to the results card (profile XP +
// plays, save) → Spanish 2-player match to results → pass-and-play (hand-off card, face-down cards never shown, a move
// out of turn rejected).
// usage: PORT=8721 node test/run.js golf test/golf.js   (add W=390 H=844 for portrait)
module.exports = async (p, shot) => {
  const log = (k, v) => console.log(k, typeof v === 'string' ? v : JSON.stringify(v));
  const fail = m => { console.error('FAIL ' + m); process.exitCode = 1; return p.evaluate(x => console.error('TEST FAIL ' + x), m); };
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const run = (n, o) => p.evaluate(({ n, o }) => window.__GAME.run(n, 1 / 30, o || {}), { n, o });
  const g = (f, a) => p.evaluate(f, a);
  const untilTurn = async (s, max = 1200) => g(({ s, max }) => { const G = window.__GAME; for (let i = 0; i < max; i++) { if (G.m.phase !== 'turns') return false; if (G.m.turn() === s && !document.querySelector('.gf-card')) return true; G.update(1 / 30); } return false; }, { s, max });
  const steps = n => g(n => { for (let i = 0; i < n; i++) window.__GAME.update(1 / 30); }, n);
  // privacy: no face-down card value anywhere in the tray DOM, and every face-down 3D card lies back up
  const privacy = () => g(() => {
    const G = window.__GAME, st = G.state, bad = [];
    const vs = G.G.viewSeat; if (G.G.revealed && document.getElementById('grid').children.length === 6) st.grids[vs].forEach((c, i) => { const b = document.querySelector(`#grid .gf-c[data-i="${i}"]`); if (!c.up && (b.querySelector('text') || !/face down|boca abajo/.test(b.getAttribute('aria-label')))) bad.push('tray ' + i); });
    const trayText = document.getElementById('tray').innerText + ' ' + [...document.querySelectorAll('#tray [aria-label]')].map(e => e.getAttribute('aria-label')).join(' ');
    st.grids.forEach((g, s) => g.forEach(c => { if (!c.up) { const nm = G.CARDS.cardName(c.card, 'en'); if (s === vs && trayText.includes(nm) && !st.grids.some(h => h.some(x => x.up && G.CARDS.cardName(x.card, 'en') === nm)) && !st.discard.some(x => G.CARDS.cardName(x, 'en') === nm) && !(st.held && G.CARDS.cardName(st.held.card, 'en') === nm)) bad.push('name ' + nm); } }));
    return bad;
  });

  await p.evaluate(() => { localStorage.removeItem('inoa.golf'); const k = 'inoa.profile'; const pr = JSON.parse(localStorage.getItem(k) || '{}'); pr.lang = 'en'; pr.voice = false; localStorage.setItem(k, JSON.stringify(pr)); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await settle(600);
  await shot('title');
  const xp0 = await g(() => (JSON.parse(localStorage.getItem('inoa.profile') || '{}').xp) || 0);

  /* ---------- solo vs 3 bots, Chill (hints), 3 holes ---------- */
  await g(() => { document.querySelector('#pN [data-n="4"]').click(); });
  await g(() => { document.querySelector('#pS [data-s=chill]').click(); document.querySelector('#pG [data-g="3"]').click(); document.querySelector('#pH [data-h="1"]').click(); });
  await g(() => { window.__GAME.fast(true); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.G && window.__GAME.phase === 'turns', null, { timeout: 20000 });
  log('seats', await g(() => window.__GAME.G.seats.map(s => `${s.kind}:${s.name}`).join(',')));
  const tray = await g(() => ({ cards: document.querySelectorAll('#grid .gf-c').length, seats: document.querySelectorAll('.gf-seat').length, up: window.__GAME.state.grids.map(g => g.filter(c => c.up).length) }));
  log('tray', tray); if (tray.cards !== 6 || tray.seats !== 3) await fail('tray should show 6 cards and 3 opponent chips');
  if (tray.up.some(n => n)) await fail('all cards start face down');
  let pv = await privacy(); if (pv.length) await fail('privacy: ' + pv.join(','));

  // setup: turn 2 cards face up with real taps (a face-up card cannot be flipped twice)
  if (!(await untilTurn(0))) await fail('never our setup turn');
  await settle(300); await shot('setup');
  await p.click('#grid .gf-c[data-i="0"]', { force: true }); await settle(120);
  const rej0 = await g(() => window.__GAME.m.rejected);
  await p.click('#grid .gf-c[data-i="0"]', { force: true }); await settle(120);
  const rej1 = await g(() => window.__GAME.m.rejected); if (rej1 !== rej0 + 1) await fail('flipping a face-up card again should be rejected');
  await p.click('#grid .gf-c[data-i="4"]', { force: true }); await settle(120);
  const afterSetup = await g(() => ({ up: window.__GAME.state.grids[0].map(c => c.up), flips: window.__GAME.state.flips }));
  log('after setup', afterSetup); if (afterSetup.up.filter(Boolean).length !== 2 || !afterSetup.up[0] || !afterSetup.up[4]) await fail('setup flips');

  // first play turn: a swap before drawing is rejected, then draw from the stock + swap by tapping
  if (!(await untilTurn(0))) await fail('never our first play turn');
  await steps(4); await settle(250); await shot('turn');
  const b0 = await g(() => ({ rej: window.__GAME.m.rejected, st: JSON.stringify(window.__GAME.state.grids) }));
  await p.click('#grid .gf-c[data-i="1"]', { force: true }); await settle(120);
  const b1 = await g(() => ({ rej: window.__GAME.m.rejected, st: JSON.stringify(window.__GAME.state.grids), turn: window.__GAME.m.turn() }));
  log('swap before draw', { rej: [b0.rej, b1.rej] }); if (b1.rej !== b0.rej + 1 || b1.st !== b0.st || b1.turn !== 0) await fail('a swap before drawing should be rejected, table unchanged');
  await p.click('#piles .gf-c[data-p=stock]', { force: true }); await settle(150);
  const held = await g(() => ({ held: window.__GAME.state.held && window.__GAME.state.held.from, hint: document.querySelector('#msg .hint')?.textContent || '', deltas: document.querySelectorAll('#grid .gf-c .d').length }));
  log('holding', held); if (held.held !== 'stock') await fail('tapping the stock should draw');
  if (!held.hint) await fail('Chill should show a hint'); if (held.deltas !== 6) await fail('hint deltas on the 6 cards');
  await steps(10); await settle(200); await shot('holding');
  const n0 = await g(() => window.__GAME.state.discard.length);
  await p.click('#grid .gf-c[data-i="2"]', { force: true }); await settle(150);
  const sw = await g(() => ({ up2: window.__GAME.state.grids[0][2].up, disc: window.__GAME.state.discard.length, turn: window.__GAME.m.turn(), held: window.__GAME.state.held }));
  log('swapped', sw); if (!sw.up2 || sw.disc !== n0 + 1 || sw.turn === 0) await fail('swap by tapping did not work');

  // next turn: draw, discard it, a face-up pick is rejected, then flip a face-down card
  if (!(await untilTurn(0))) await fail('never our second play turn');
  await steps(4);
  await p.click('#piles .gf-c[data-p=stock]', { force: true }); await settle(120);
  await p.click('#piles [data-a=discard]', { force: true }); await settle(120);
  const fm = await g(() => ({ flip: window.__GAME.G.flip, msg: document.getElementById('msg').textContent }));
  log('flip mode', fm); if (!fm.flip) await fail('Discard it should ask for a card to turn up');
  await shot('flipmode');
  const r0 = await g(() => window.__GAME.m.rejected);
  await p.click('#grid .gf-c[data-i="0"]', { force: true }); await settle(120);
  if ((await g(() => window.__GAME.m.rejected)) !== r0 + 1) await fail('flipping a face-up card after discarding should be rejected');
  const fd = await g(() => window.__GAME.state.grids[0].findIndex(c => !c.up));
  await p.click(`#grid .gf-c[data-i="${fd}"]`, { force: true }); await settle(120);
  const df = await g(i => ({ up: window.__GAME.state.grids[0][i].up, turn: window.__GAME.m.turn() }), fd);
  log('discard + flip', df); if (!df.up || df.turn === 0) await fail('discard + flip did not work');

  // keyboard turn: arrows move the focus ring, Space presses (stock), then a grid card
  if (await untilTurn(0)) {
    await steps(4); const press = async k => { await p.keyboard.down(k); await steps(1); await p.keyboard.up(k); await steps(1); };
    await press('ArrowRight'); const f1 = await g(() => document.activeElement?.dataset?.p || document.activeElement?.dataset?.i || document.activeElement?.className);
    if (f1 !== 'stock') { log('focus', f1); }
    await g(() => document.querySelector('#piles .gf-c[data-p=stock]').focus());
    await press('Space'); const kh = await g(() => window.__GAME.state.held && window.__GAME.state.held.from);
    await press('ArrowDown'); await press('ArrowDown'); const f2 = await g(() => document.activeElement?.dataset?.i);
    await press('Space'); const kd = await g(() => ({ turn: window.__GAME.m.turn(), held: window.__GAME.state.held }));
    log('keyboard', { f1, kh, f2, kd }); if (kh !== 'stock' || f2 == null || kd.turn === 0) await fail('keyboard play did not draw + swap');
  }
  await settle(300); await shot('midround');
  pv = await privacy(); if (pv.length) await fail('privacy: ' + pv.join(','));
  // 3D: every face-down card lies back up once its animation is done
  const face = await g(() => { const G = window.__GAME; let bad = 0, down = 0, n = 0;
    G.state.grids.forEach(gr => gr.forEach(c => { const ms = G.cardMesh(c.card.id); if (!ms || ms.userData.a) return; n++; const z = ((ms.rotation.z % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const isDown = Math.abs(z - Math.PI) < .05; if (!c.up) down++; if (isDown === !!c.up) bad++; })); return { n, down, bad }; });
  log('3d check', face); if (face.bad) await fail('a 3D card shows the wrong side');

  // finish the match on autopilot (seat 0 plays like a Sharp bot), stopping at the first hole card
  await g(() => window.__GAME.auto(true));
  const ph1 = await run(6000); log('after autopilot', ph1);
  await settle(500); await shot('hole_card');
  log('hole', await g(() => { const o = window.__GAME.G.lastRound; return { scores: o.scores, winners: o.winners, pairs: o.pairs, totals: window.__GAME.m.scores, allUp: window.__GAME.state.grids.every(g => g.every(c => c.up)) }; }));
  const ph2 = await run(60000, { skipCards: true }); log('match', { phase: ph2, scores: await g(() => window.__GAME.m.scores), holes: await g(() => window.__GAME.G.stats.holes), botMoves: await g(() => window.__GAME.m.log.filter(l => l.from === 'bot').length), rejected: await g(() => window.__GAME.m.rejected) });
  if (ph2 !== 'matchEnd') await fail('match did not finish');
  if ((await g(() => window.__GAME.G.stats.holes)) !== 3) await fail('a 3-hole match should play 3 holes');
  await g(() => window.__GAME.next()); await settle(600);
  await shot('results');
  const res = await g(() => ({ card: !!document.querySelector('.ig-results'), title: document.querySelector('.ig-results h2')?.textContent, plays: JSON.parse(localStorage.getItem('inoa.profile')).games.golf?.plays, xp: JSON.parse(localStorage.getItem('inoa.profile')).xp, save: JSON.parse(localStorage.getItem('inoa.golf')) }));
  log('results', res); if (!res.card || res.plays !== 1 || !(res.xp > xp0)) await fail('results card / profile XP missing');
  if (!res.save || res.save.played !== 1) await fail('save not written');
  if (JSON.stringify(res.save).length > 2000) await fail('save too big');

  /* ---------- Spanish, 2 players, Sharp, 3 holes ---------- */
  await p.click('.ig-results [data-a=again]'); await settle(400);
  await g(() => document.querySelector('#pL [data-l=es]').click()); await settle(300);
  const esTitle = await g(() => ({ h1: document.querySelector('.ig-title h1').textContent, lang: document.documentElement.lang }));
  log('es title', esTitle); if (esTitle.h1 !== 'Golf de seis cartas') await fail('Spanish title');
  await shot('title_es');
  await g(() => { document.querySelector('#pN [data-n="2"]').click(); });
  await g(() => { document.querySelector('#pS [data-s=sharp]').click(); document.querySelector('#pG [data-g="3"]').click(); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.phase === 'turns', null, { timeout: 20000 });
  // play our setup + one turn in Spanish by tapping
  if (await untilTurn(0)) { await p.click('#grid .gf-c[data-i="1"]', { force: true }); await settle(100); await p.click('#grid .gf-c[data-i="5"]', { force: true }); await settle(100); }
  if (await untilTurn(0)) { await steps(4); await p.click('#piles .gf-c[data-p=discard]', { force: true }); await settle(200); await shot('es_holding'); const txt = await g(() => document.getElementById('msg').textContent); log('es msg', txt); if (!/Toca una de tus cartas/.test(txt)) await fail('Spanish tray message'); await p.click('#grid .gf-c[data-i="0"]', { force: true }); await settle(100); }
  await g(() => window.__GAME.auto(true));
  const ph3 = await run(60000, { skipCards: true }); log('es match', { phase: ph3, scores: await g(() => window.__GAME.m.scores) });
  await settle(300); await shot('es_hole');
  await g(() => window.__GAME.next()); await settle(500);
  const res2 = await g(() => ({ card: !!document.querySelector('.ig-results'), title: document.querySelector('.ig-results h2')?.textContent, again: document.querySelector('.ig-results [data-a=again]')?.textContent, plays: JSON.parse(localStorage.getItem('inoa.profile')).games.golf?.plays }));
  log('es results', res2); if (!res2.card || res2.plays !== 2 || !/Otra/.test(res2.again || '')) await fail('Spanish results');
  await shot('es_results');
  await p.click('.ig-results [data-a=again]'); await settle(300);
  await g(() => document.querySelector('#pL [data-l=en]').click()); await settle(300);

  /* ---------- pass-and-play: 2 people + 1 bot ---------- */
  await g(() => { document.querySelector('#pN [data-n="3"]').click(); });
  await g(() => { document.querySelector('#pS [data-s=normal]').click(); document.querySelector('#pH [data-h="2"]').click(); document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForFunction(() => window.__GAME.phase === 'turns', null, { timeout: 20000 });
  log('hot-seat seats', await g(() => window.__GAME.G.seats.map(s => `${s.kind}:${s.name}`).join(',')));
  let handoffs = 0, outOfTurn = false;
  for (let k = 0; k < 12 && handoffs < 4; k++) {
    const t = await g(() => { const G = window.__GAME; for (let i = 0; i < 1200; i++) { if (G.m.phase !== 'turns') return null; if (document.querySelector('.gf-card [data-a=show]')) return G.m.turn(); G.update(1 / 30); } return null; });
    if (t == null) break;
    handoffs++;
    const hidden = await g(() => ({ cards: document.querySelectorAll('#grid .gf-c').length, text: document.getElementById('who').textContent, card: document.querySelector('.gf-card h2').textContent }));
    log('handoff ' + handoffs, { seat: t, ...hidden }); if (hidden.cards !== 0) await fail('cards visible behind the hand-off card');
    if (handoffs === 1) { await settle(300); await shot('handoff'); }
    await p.click('.gf-card [data-a=show]'); await settle(150);
    const shown = await g(s => { const G = window.__GAME; return { n: document.querySelectorAll('#grid .gf-c').length, vs: G.G.viewSeat }; }, t);
    if (shown.n !== 6 || shown.vs !== t) await fail('tray does not show the current player\'s cards');
    pv = await privacy(); if (pv.length) await fail('privacy (hot seat): ' + pv.join(','));
    if (!outOfTurn) { const other = await g(s => { const G = window.__GAME; const o = G.G.seats.findIndex((x, i) => i !== s && x.kind === 'local'); return G.act(o, { type: 'draw', from: 'stock' }, 'local').reason; }, t); log('out-of-turn move', other); if (other !== 'not-your-turn') await fail('host should reject a move out of turn'); outOfTurn = true; }
    if (handoffs === 2) await shot('hotseat_tray');
    // play this turn with taps: setup flips, or draw stock + swap slot 3
    const ph = await g(() => window.__GAME.state.phase);
    if (ph === 'setup') { const fdn = await g(s => window.__GAME.state.grids[s].map((c, i) => c.up ? -1 : i).filter(i => i >= 0), t); await p.click(`#grid .gf-c[data-i="${fdn[0]}"]`, { force: true }); await settle(80); await p.click(`#grid .gf-c[data-i="${fdn[1]}"]`, { force: true }); }
    else { await p.click('#piles .gf-c[data-p=stock]', { force: true }); await settle(80); await p.click('#grid .gf-c[data-i="3"]', { force: true }); }
    await settle(100);
  }
  log('hot-seat', { handoffs }); if (handoffs < 3) await fail('expected at least three hand-off cards');
  await g(() => window.__GAME.title()); await settle(300);
  await shot('title_end');
};
