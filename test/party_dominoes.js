// Dominoes with phones as private hands: two phones join, each becomes a seat (plus one bot). Each phone shows only its own
// tiles; the host rejects an illegal tile and a move out of turn (the table does not change), then accepts a legal one.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/dominoes.html?online=1', { label: 'host', init: () => { try { localStorage.setItem('inoa.profile', JSON.stringify({ lang: 'en', voice: false })); } catch (e) { } } }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); log('room', code);
  const a = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'padA' });
  await a.evaluate(() => localStorage.setItem('inoa.pad', JSON.stringify({ name: 'Ana' })));
  await wait(a, () => window.__PAD.net.me);
  const b = await open('pad.html?join=' + code, { w: 390, h: 844, label: 'padB' });
  await wait(b, () => window.__PAD.net.me);
  await host.click('.inoa-pp [data-x]');
  log('title line:', await host.$eval('#pPh', e => e.textContent));
  await host.evaluate(() => { window.__GAME.fast(true); window.__GAME.start({ players: 3, locals: 0, mode: 'block', skill: 'normal', seed: 4242 }); });
  const seats = await host.evaluate(() => window.__GAME.G.seats.map(s => `${s.kind}${s.slot ? '#' + s.slot : ''}:${s.name}`));
  log('seats', seats.join(',')); if (seats.filter(s => s.startsWith('phone')).length !== 2) throw new Error('expected two phone seats');
  const step = async n => { for (let i = 0; i < n; i += 10) { await host.evaluate(() => { for (let j = 0; j < 10; j++) window.__GAME.update(1 / 20); }); await host.waitForTimeout(20); } };
  await step(4);
  const tilesOf = p => p.$$eval('#htiles button', bs => bs.map(x => x.getAttribute('aria-label').replace(/\s/g, '')));
  const handOf = s => host.evaluate(s => window.__GAME.state.hands[s].map(t => `${t[0]}|${t[1]}`), s);
  await wait(a, () => !document.getElementById('handL').hidden, null, 10000); await wait(b, () => !document.getElementById('handL').hidden, null, 10000);
  await a.waitForTimeout(300);
  const [ta, tb, ha, hb] = [await tilesOf(a), await tilesOf(b), await handOf(0), await handOf(1)];
  log('pad A tiles', ta.join(' ')); log('pad B tiles', tb.join(' '));
  if (ta.join() !== ha.join() || tb.join() !== hb.join()) throw new Error('a phone does not show exactly its own hand');
  if (ta.some(t => tb.includes(t))) throw new Error('a tile shows on two phones');
  await shot(a, 'padA_hand'); await shot(host, 'host_table');
  // run until it is a phone's turn
  let turn = null; for (let i = 0; i < 60; i++) { turn = await host.evaluate(() => window.__GAME.m.turn()); if (turn === 0 || turn === 1) break; await step(10); }
  log('phone turn', turn); const me = turn === 0 ? a : b, other = turn === 0 ? b : a;
  await me.waitForTimeout(400);
  // 1) the other phone taps while it is not their turn → rejected
  const before = await host.evaluate(() => ({ line: window.__GAME.state.line.length, rej: window.__GAME.m.rejected }));
  await other.locator('#htiles button').first().dispatchEvent('pointerdown'); await other.waitForTimeout(400); await step(2);
  const r1 = await host.evaluate(() => ({ line: window.__GAME.state.line.length, rej: window.__GAME.m.rejected }));
  log('out of turn', { before, r1 }); if (r1.rej !== before.rej + 1 || r1.line !== before.line) throw new Error('host accepted a move out of turn');
  await other.waitForTimeout(300); log('other phone note', await other.$eval('#hq small', e => e.textContent));
  // 2) the phone whose turn it is taps a tile that is not legal (if it has one) → rejected, table unchanged
  const plan = await host.evaluate(s => { const G = window.__GAME, st = G.state, legal = G.legal(s), keys = legal.filter(m => m.type === 'play').map(m => G.D.key(m.tile)); const hand = st.hands[s]; return { bad: hand.findIndex(t => !keys.includes(G.D.key(t))), good: hand.findIndex(t => keys.includes(G.D.key(t))), act: legal[0].type }; }, turn);
  log('plan', plan);
  if (plan.bad >= 0) {
    await me.locator('#htiles button').nth(plan.bad).dispatchEvent('pointerdown'); await me.waitForTimeout(400); await step(2);
    const r2 = await host.evaluate(() => ({ line: window.__GAME.state.line.length, rej: window.__GAME.m.rejected, turn: window.__GAME.m.turn() }));
    log('illegal tile', r2); if (r2.rej !== r1.rej + 1 || r2.line !== r1.line || r2.turn !== turn) throw new Error('host accepted an illegal tile');
    await me.waitForTimeout(300); log('phone warning', await me.$eval('#hq small', e => e.textContent)); await shot(me, 'pad_rejected');
  }
  // 3) a legal tile (or draw/pass) is accepted
  if (plan.good >= 0) {
    await me.locator('#htiles button').nth(plan.good).dispatchEvent('pointerdown'); await me.waitForTimeout(400); await step(2);
    if (await me.evaluate(() => document.querySelectorAll('#hacts button').length === 3)) { log('both ends: picking left'); await shot(me, 'pad_ends'); await me.locator('#hacts button').first().dispatchEvent('pointerdown'); await me.waitForTimeout(400); await step(2); }
  } else { await me.locator('#hacts button').first().dispatchEvent('pointerdown'); await me.waitForTimeout(400); await step(2); }
  const r3 = await host.evaluate(() => ({ line: window.__GAME.state.line.length, turn: window.__GAME.m.turn(), hand: window.__GAME.state.hands.map(h => h.length) }));
  log('after legal move', r3); if (r3.turn === turn && plan.good >= 0) throw new Error('legal phone move was not accepted');
  await me.waitForTimeout(400); log('phone after', (await tilesOf(me)).length, 'tiles,', await me.$eval('#hq', e => e.textContent));
  await shot(host, 'host_after');
};
