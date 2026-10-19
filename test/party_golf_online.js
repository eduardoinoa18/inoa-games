// Six-Card Golf online on separate screens (roadmap R7): two friends open games/golf.html?join=CODE and take seats at the
// host's table next to a bot. A guest page never holds a face-down card (its own included), the stock order or a card
// another player drew from the stock; moves out of turn are refused on the guest, a forged move is refused by the host,
// and the match (3 holes) runs to the end through the host with results on every guest screen.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const init = () => { try { localStorage.setItem('inoa.profile', JSON.stringify({ lang: 'en', voice: false })); } catch (e) { } };
  const host = await open('games/golf.html?online=1', { label: 'host', init, w: 640, h: 360 }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim());
  const link = await host.$eval('.inoa-pp .online .url', e => e.textContent.trim()); log('room', code, 'online link', link);
  if (!/golf\.html\?join=/.test(link)) throw new Error('party panel has no online link');
  const a = await open('games/golf.html?join=' + code, { label: 'guestA', init, w: 640, h: 360 }); await ready(a);
  await wait(a, () => /You're in/.test(document.querySelector('.ig-room')?.textContent || ''), null, 60000);
  const b = await open('games/golf.html?join=' + code, { w: 360, h: 640, label: 'guestB', init }); await ready(b);
  await wait(b, () => /You're in/.test(document.querySelector('.ig-room')?.textContent || ''), null, 60000);
  await host.click('.inoa-pp [data-x]');
  await wait(host, () => /online player/.test(document.getElementById('pPh')?.textContent || ''), null, 8000);
  await host.evaluate(() => { window.__GAME.fast(true); window.__GAME.start({ players: 3, locals: 0, holes: 3, skill: 'normal', seed: 31 }); });
  const seats = await host.evaluate(() => window.__GAME.G.seats.map(s => `${s.kind}${s.slot ? '#' + s.slot : ''}:${s.name}`)); log('host seats', seats.join(','));
  if (seats.filter(s => s.startsWith('online')).length !== 2) throw new Error('expected two online seats');
  await wait(a, () => window.__GAME.G && window.__GAME.G.m.state, null, 20000); await wait(b, () => window.__GAME.G && window.__GAME.G.m.state, null, 20000);
  const leak = p => p.evaluate(() => { const G = window.__GAME.G, st = G.m.state; let n = 0; st.grids.forEach(g => g.forEach(c => { if (!c.up && c.card) n++; })); if (st.stock.some(c => c)) n++; if (st.seed) n++; if (st.held && st.turn !== G.viewSeat && st.held.from === 'stock' && st.held.card) n++; return n; });
  const hostStep = n => host.evaluate(n => { for (let j = 0; j < n; j++) window.__GAME.update(1 / 20); }, n);
  await a.evaluate(() => { window.__GAME.update(.1); }); await shot(a, 'guest_table'); await shot(b, 'guest_table_p'); await shot(host, 'host_table');
  // wait for a guest's turn, then check refusals
  const seatOf = p => p.evaluate(() => window.__GAME.G.viewSeat); const [sa, sb] = [await seatOf(a), await seatOf(b)];
  let turn = null; for (let i = 0; i < 80; i++) { turn = await host.evaluate(() => window.__GAME.G.m.turn()); if (turn === sa || turn === sb) break; await hostStep(8); await host.waitForTimeout(30); }
  const me = turn === sa ? a : b, other = me === a ? b : a; log('guest turn: seat', turn);
  await wait(me, t => window.__GAME.G.m.turn() === t, turn, 8000);
  const r0 = await other.evaluate(() => window.__GAME.G.m.act(window.__GAME.G.viewSeat, { type: 'flip', i: 0 }));
  log('out of turn on the guest', JSON.stringify(r0)); if (r0.ok || r0.reason !== 'not-your-turn') throw new Error('guest page accepted a move out of turn');
  const rejBefore = await host.evaluate(() => window.__GAME.G.m.rejected);
  await other.evaluate(() => window.__GAME.rawAct({ type: 'flip', i: 0 })); await host.waitForTimeout(800); await hostStep(2);
  const rejAfter = await host.evaluate(() => window.__GAME.G.m.rejected); log('forged move: host rejected', rejAfter - rejBefore);
  if (rejAfter !== rejBefore + 1) throw new Error('host accepted a forged move');
  // play it out: guests move from their own view; check for leaks on every guest move
  let leaks = 0, results = null, guestMoves = 0;
  for (let i = 0; i < 1500; i++) {
    for (const p of [a, b]) { leaks += await leak(p); guestMoves += await p.evaluate(() => { const g = window.__GAME, G = g.G; if (!G) return 0; g.update(1 / 20); const nx = document.querySelector('.gf-card [data-a=next]'); if (nx && G.m.phase !== 'turns') nx.click(); if (G.m.phase === 'turns' && G.m.turn() === G.viewSeat && !G.m.pending) { g.G.m.act(G.viewSeat, G.m.game.botMove(G.m.view(G.viewSeat), 'normal', Math.random)); return 1; } return 0; }); }
    const ph = await host.evaluate(() => window.__GAME.run(12, 1 / 20, { skipCards: true }));
    if (ph === 'matchEnd') { results = await Promise.all([a, b].map(p => p.evaluate(() => !!document.querySelector('.ig-results')))); if (results.every(Boolean)) break; }
    if (i === 40) { await shot(a, 'guest_midgame'); await shot(b, 'guest_midgame_p'); }
  }
  const fin = await host.evaluate(() => ({ phase: window.__GAME.G.m.phase, scores: window.__GAME.G.m.scores, holes: window.__GAME.G.m.round }));
  log('match', JSON.stringify(fin), 'guest moves', guestMoves, 'leaks', leaks);
  if (leaks) throw new Error('a guest page held hidden cards');
  if (fin.phase !== 'matchEnd') throw new Error('online match did not finish');
  if (!(results && results.every(Boolean))) throw new Error('a guest did not get its own results');
  log('guest A results:', await a.$eval('.ig-results h2', e => e.textContent)); await shot(a, 'guest_results');
};
