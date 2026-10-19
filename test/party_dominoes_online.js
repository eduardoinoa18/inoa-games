// Dominoes online on separate screens (roadmap R7): two friends open games/dominoes.html?join=CODE and take seats at the
// host's table next to a bot. Each guest's page holds only its own tiles (other hands and the boneyard arrive as nulls),
// shows the table from its own seat, refuses moves out of turn, and the host refuses a forged one. The match runs to the
// end through the host and every guest gets its own results.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const init = () => { try { localStorage.setItem('inoa.profile', JSON.stringify({ lang: 'en', voice: false })); } catch (e) { } };
  const host = await open('games/dominoes.html?online=1', { label: 'host', init, w: 640, h: 360 }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim());
  const link = await host.$eval('.inoa-pp .online .url', e => e.textContent.trim()); log('room', code, 'online link', link);
  if (!/dominoes\.html\?join=/.test(link)) throw new Error('party panel has no online link');
  const a = await open('games/dominoes.html?join=' + code, { label: 'guestA', init, w: 640, h: 360 }); log('guest A open'); await ready(a);
  await wait(a, () => /You're in/.test(document.querySelector('.ig-room')?.textContent || ''), null, 30000);
  const b = await open('games/dominoes.html?join=' + code, { w: 360, h: 640, label: 'guestB', init }); await ready(b);
  await wait(b, () => /You're in/.test(document.querySelector('.ig-room')?.textContent || ''), null, 30000);
  await shot(a, 'guest_lobby');
  await host.click('.inoa-pp [data-x]');
  await wait(host, () => /online player/.test(document.getElementById('pPh')?.textContent || ''), null, 8000);
  log('title line:', await host.$eval('#pPh', e => e.textContent));
  await host.evaluate(() => { window.__GAME.fast(true); window.__GAME.start({ players: 3, locals: 0, mode: 'draw', skill: 'normal', target: 50, seed: 777 }); });
  const seats = await host.evaluate(() => window.__GAME.G.seats.map(s => `${s.kind}${s.slot ? '#' + s.slot : ''}:${s.name}`)); log('host seats', seats.join(','));
  if (seats.filter(s => s.startsWith('online')).length !== 2) throw new Error('expected two online seats');
  await wait(a, () => window.__GAME.G && window.__GAME.state, null, 15000); await wait(b, () => window.__GAME.G && window.__GAME.state, null, 15000);
  const hostStep = n => host.evaluate(n => { for (let j = 0; j < n; j++) window.__GAME.update(1 / 20); }, n);
  // 1) privacy: a guest page holds exactly its own hand; the rest are nulls
  const peek = p => p.evaluate(() => { const G = window.__GAME.G, st = G.m.state; return { base: G.base, view: G.viewSeat, kinds: G.seats.map(s => s.kind).join(','), mine: st.hands[G.base].map(t => t.join('|')), others: st.hands.map((h, i) => i === G.base ? 0 : h.filter(t => t !== null).length).reduce((x, y) => x + y, 0), bone: st.boneyard.filter(t => t !== null).length, tray: [...document.querySelectorAll('#hand .dm-tile')].map(x => x.dataset.k) }; });
  const [pa, pb] = [await peek(a), await peek(b)]; log('guest A', JSON.stringify(pa)); log('guest B', JSON.stringify(pb));
  const handOf = s => host.evaluate(s => window.__GAME.state.hands[s].map(t => t.join('|')), s);
  if (pa.mine.join() !== (await handOf(pa.base)).join() || pb.mine.join() !== (await handOf(pb.base)).join()) throw new Error('a guest does not hold exactly its own hand');
  if (pa.others || pb.others || pa.bone || pb.bone) throw new Error('a guest received hidden tiles');
  if (pa.tray.length !== pa.mine.length) throw new Error('guest tray does not show its hand');
  await shot(a, 'guest_table'); await shot(b, 'guest_table_p'); await shot(host, 'host_table');
  // 2) wait for a guest's turn
  const pageOf = s => s === pa.base ? a : s === pb.base ? b : null;
  let turn = null; for (let i = 0; i < 80; i++) { turn = await host.evaluate(() => window.__GAME.m.turn()); if (pageOf(turn)) break; await hostStep(8); await host.waitForTimeout(30); }
  const me = pageOf(turn), other = me === a ? b : a; log('guest turn: seat', turn);
  await wait(me, t => window.__GAME.m.turn() === t, turn, 8000);
  // out of turn on the other guest's own screen → refused there, nothing sent
  const r0 = await other.evaluate(() => window.__GAME.act(window.__GAME.G.base, { type: 'pass' }));
  log('out of turn on the guest', JSON.stringify(r0)); if (r0.ok || r0.reason !== 'not-your-turn') throw new Error('guest page accepted a move out of turn');
  // a forged move sent straight to the host → the host refuses it and tells that guest
  const rejBefore = await host.evaluate(() => window.__GAME.m.rejected);
  await other.evaluate(() => window.__GAME.rawAct({ type: 'pass' })); await host.waitForTimeout(600); await hostStep(2);
  const rejAfter = await host.evaluate(() => window.__GAME.m.rejected); const otherRej = await other.evaluate(() => window.__GAME.m.rejected);
  log('forged move: host rejected', rejAfter - rejBefore, 'guest heard', otherRej); if (rejAfter !== rejBefore + 1) throw new Error('host accepted a forged move');
  // a legal move from the guest whose turn it is, through the normal tray tap
  const lineBefore = await host.evaluate(() => window.__GAME.state.line.length + window.__GAME.state.boneyard.length);
  await me.evaluate(() => { const G = window.__GAME.G, lm = window.__GAME.legal(G.base); const mv = lm.find(m => m.type === 'play'); if (mv) { const i = G.m.state.hands[G.base].findIndex(t => t.join() === mv.tile.join()); window.__GAME.tapTile(i); const pick = document.querySelector('#endPick:not([hidden]) [data-e=L]'); if (pick) pick.click(); } else window.__GAME.localAction(); });
  await wait(host, n => window.__GAME.state.line.length + window.__GAME.state.boneyard.length !== n, lineBefore, 8000);
  await wait(other, n => window.__GAME.state.line.length + window.__GAME.state.boneyard.length !== n, lineBefore, 8000);
  log('guest move reached the host and the other guest');
  // 3) play the match out: guests move from their own view (bot logic), the host runs its bot and clicks through round cards
  let results = 0;
  for (let i = 0; i < 900; i++) {
    for (const p of [a, b]) await p.evaluate(() => { const g = window.__GAME, G = g.G; if (!G) return; g.update(1 / 20); if (G.m.phase === 'turns' && G.m.turn() === G.base && !G.m.pending) g.act(G.base, g.D.botMove(G.m.view(G.base), 'normal', Math.random)); const nx = document.querySelector('.dm-card [data-a=next]'); if (nx && G.m.phase !== 'turns') nx.click(); });
    const ph = await host.evaluate(() => window.__GAME.run(12, 1 / 20, { skipCards: true }));
    if (i === 25) { await a.evaluate(() => window.__GAME.update(1)); await shot(a, 'guest_midgame'); await shot(b, 'guest_midgame_p'); }
    if (ph === 'matchEnd') { results = await Promise.all([a, b].map(p => p.evaluate(() => !!document.querySelector('.ig-results')))); if (results.every(Boolean)) break; }
    await host.waitForTimeout(20);
  }
  const fin = await host.evaluate(() => ({ phase: window.__GAME.phase, scores: window.__GAME.m.scores, rounds: window.__GAME.m.round }));
  log('match', JSON.stringify(fin)); if (fin.phase !== 'matchEnd') throw new Error('online match did not finish');
  if (!(results && results.every(Boolean))) throw new Error('a guest did not get its own results');
  log('guest A results:', await a.$eval('.ig-results h2', e => e.textContent)); await shot(a, 'guest_results');
};
