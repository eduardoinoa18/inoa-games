// Six-Card Golf with phones as private hands (pad `cards` layout): two phones join, each becomes a seat (plus one bot).
// Each phone shows only its own six cards (face-down ones as backs) and never another player's stock draw; the host
// rejects a move out of turn, a second flip of the same card and a swap before drawing (the table does not change),
// then accepts legal flips, a stock draw and a discard + flip.
// usage: PORT=8741 SIG=9741 node test/party.js test/party_golf.js
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/golf.html?online=1', { label: 'host', init: () => { try { localStorage.setItem('inoa.profile', JSON.stringify({ lang: 'en', voice: false })); } catch (e) { } } }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); log('room', code);
  const a = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'padA' });
  await a.evaluate(() => localStorage.setItem('inoa.pad', JSON.stringify({ name: 'Ana' })));
  await wait(a, () => window.__PAD.net.me);
  const b = await open('pad.html?join=' + code, { w: 390, h: 844, label: 'padB' });
  await wait(b, () => window.__PAD.net.me);
  await host.click('.inoa-pp [data-x]');
  log('title line:', await host.$eval('#pPh', e => e.textContent));
  await host.evaluate(() => { window.__GAME.fast(true); window.__GAME.start({ players: 3, locals: 0, holes: 3, skill: 'normal', seed: 4242 }); });
  const seats = await host.evaluate(() => window.__GAME.G.seats.map(s => `${s.kind}${s.slot ? '#' + s.slot : ''}:${s.name}`));
  log('seats', seats.join(',')); if (seats.filter(s => s.startsWith('phone')).length !== 2) throw new Error('expected two phone seats');
  const step = async n => { for (let i = 0; i < n; i += 10) { await host.evaluate(() => { for (let j = 0; j < 10; j++) window.__GAME.update(1 / 20); }); await host.waitForTimeout(20); } };
  const st = () => host.evaluate(() => ({ turn: window.__GAME.m.turn(), phase: window.__GAME.state.phase, rej: window.__GAME.m.rejected, grids: JSON.stringify(window.__GAME.state.grids), held: window.__GAME.state.held && window.__GAME.state.held.from }));
  const tap = async (p, sel) => { await p.locator(sel).dispatchEvent('pointerdown'); await p.waitForTimeout(350); await step(2); };
  // what a phone shows: aria labels of its 6 grid cards, and of the held card
  const shows = p => p.evaluate(() => ({ grid: [...document.querySelectorAll('#cgrid button')].map(x => x.getAttribute('aria-label')), held: document.querySelector('#cpiles .held')?.getAttribute('aria-label') || null, note: document.querySelector('#kq small')?.textContent || '' }));
  const expect = s => host.evaluate(s => window.__GAME.state.grids[s].map(c => c.up ? window.__GAME.CARDS.cardName(c.card, 'en') : 'face-down card'), s);
  const privacy = async () => { for (const [p, s] of [[a, 0], [b, 1]]) { const got = (await shows(p)).grid, want = await expect(s); if (got.join('|') !== want.join('|')) throw new Error(`phone ${s} shows ${got.join('|')} but may see ${want.join('|')}`); } };
  await step(4);
  await wait(a, () => !document.getElementById('cardsL').hidden, null, 10000); await wait(b, () => !document.getElementById('cardsL').hidden, null, 10000);
  await a.waitForTimeout(300);
  await privacy(); log('phones show only their own grids (all face down)');
  await shot(a, 'padA_cards'); await shot(host, 'host_table');
  // setup: seat 0 (phone A) starts. B taps out of turn → rejected
  let s0 = await st(); log('turn', s0.turn, s0.phase); if (s0.turn !== 0) throw new Error('phone A should start hole 1');
  await tap(b, '#cgrid button >> nth=0'); let s1 = await st();
  if (s1.rej !== s0.rej + 1 || s1.grids !== s0.grids) throw new Error('host accepted a move out of turn');
  await b.waitForTimeout(300); log('B note', (await shows(b)).note);
  await tap(a, '#cgrid button >> nth=0'); await tap(a, '#cgrid button >> nth=0'); let s2 = await st();
  if (s2.rej !== s1.rej + 1) throw new Error('host accepted flipping the same card twice');
  await tap(a, '#cgrid button >> nth=4'); let s3 = await st(); log('after A setup', s3.turn, s3.phase);
  if (s3.turn !== 1) throw new Error('setup turn should pass to phone B');
  await tap(b, '#cgrid button >> nth=1'); await tap(b, '#cgrid button >> nth=5');
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.turn === 0 && s.phase === 'play') break; await step(10); }
  await a.waitForTimeout(300); await privacy(); log('setup done, privacy holds with face-up cards');
  // play: A swaps before drawing → rejected; draws from the stock → only A sees the card
  const p0 = await st(); if (p0.turn !== 0 || p0.phase !== 'play') throw new Error('expected phone A to play first');
  await tap(a, '#cgrid button >> nth=2'); const p1 = await st();
  if (p1.rej !== p0.rej + 1 || p1.grids !== p0.grids) throw new Error('host accepted a swap before drawing');
  await a.waitForTimeout(300); log('A warning', (await shows(a)).note); await shot(a, 'pad_rejected');
  await tap(a, '#cpiles button >> nth=0'); const p2 = await st(); if (p2.held !== 'stock') throw new Error('stock draw from the phone was not accepted');
  await a.waitForTimeout(400); const sa = await shows(a), sb = await shows(b);
  log('A holds', sa.held, '| B sees', sb.held); if (!sa.held || sb.held) throw new Error('the drawn card must show on the drawer\'s phone only');
  await shot(a, 'pad_holding');
  // discard it, then turn a face-down card up
  await tap(a, '#cacts button >> nth=0'); await a.waitForTimeout(300); log('A note', (await shows(a)).note);
  const fd = await host.evaluate(() => window.__GAME.state.grids[0].findIndex(c => !c.up));
  await tap(a, `#cgrid button >> nth=${fd}`); const p3 = await st();
  log('after discard + flip', p3.turn, p3.held); if (p3.turn !== 1 || p3.held) throw new Error('discard + flip from the phone was not accepted');
  await a.waitForTimeout(400); await privacy();
  // B draws the discard and swaps
  await tap(b, '#cpiles button >> nth=1'); await tap(b, '#cgrid button >> nth=3'); const p4 = await st(); const b3 = await host.evaluate(() => window.__GAME.state.grids[1][3].up); log('after B', p4.turn, 'slot 3 up', b3);
  if (p4.turn === 1 || !b3) throw new Error('phone B swap not accepted');
  await b.waitForTimeout(400); await privacy(); await shot(b, 'padB_after'); await shot(host, 'host_after');
};
