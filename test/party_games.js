// Smoke test for phone players in Depths (phone 2 = P2), Tide Lines (phone 2 joins your team),
// and Draw the Pact party mode (drawer gets the word on their phone, others guess on theirs).
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/depths.html', { label: 'depths' }); await ready(host);
  await host.click('[data-a=phones]'); await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); await host.click('.inoa-pp [data-x]');
  const p1 = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad1' }); await wait(p1, () => window.__PAD.net.me);
  const p2 = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad2' }); await wait(p2, () => window.__PAD.net.me);
  await host.evaluate(() => { document.querySelectorAll('.ig-title').forEach(e => e.remove()); window.__GAME.newRun({}); });
  await wait(host, () => window.__GAME.G && window.__GAME.G.heroes, null, 20000);
  await host.evaluate(() => { for (let i = 0; i < 20; i++) window.__GAME.update(1 / 30); });
  await host.waitForTimeout(400);
  log('depths heroes', await host.evaluate(() => window.__GAME.G.heroes.map(h => h.cls + ':' + h.ctrl + (h.netName ? '(' + h.netName + ')' : '')).join(' ')));
  await p2.waitForTimeout(400);
  log('pad2 buttons', await p2.evaluate(() => ['bA', 'bB', 'bC', 'bD'].map(id => document.getElementById(id).textContent).join(' ')));
  // P2 phone moves its hero
  const before = await host.evaluate(() => { const h = window.__GAME.G.heroes.find(h => h.ctrl === 'net'); return h.x; });
  await p2.evaluate(() => { const z = document.getElementById('stickZone'); const r = z.getBoundingClientRect(); const o = { pointerId: 7, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; z.dispatchEvent(new PointerEvent('pointerdown', o)); z.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: o.clientX + 60 })); });
  await p2.waitForTimeout(500);
  await host.evaluate(() => { for (let i = 0; i < 30; i++) window.__GAME.update(1 / 30); });
  const after = await host.evaluate(() => { const h = window.__GAME.G.heroes.find(h => h.ctrl === 'net'); return h.x; });
  log('P2 hero moved', (after - before).toFixed(2)); if (!(after - before > .3)) throw new Error('phone P2 did not move hero');
  await shot(host, 'depths');
  // Tide Lines: same room follows the host
  await host.goto(host.url().replace('depths.html', 'tidelines.html')); await ready(host);
  await wait(host, async () => { const E = await import('/engine/inoa3d.js'); return E.net.pads().length === 2; }, null, 40000);
  await host.evaluate(() => document.querySelector('[data-a=play]').click());
  await host.waitForTimeout(500);
  await host.evaluate(() => { for (let i = 0; i < 90; i++) window.__GAME.update(1 / 30); });
  log('tide units', await host.evaluate(async () => { const g = window.__GAME; const us = g.units || (g.G && g.G.units) || []; return us.filter(u => u.netSlot).map(u => u.name + '#' + u.netSlot + ' team' + u.team).join(','); }));
  // Draw party mode with phones
  await host.goto(host.url().replace('tidelines.html', 'draw.html')); await ready(host);
  await wait(host, async () => { const E = await import('/engine/inoa3d.js'); return E.net.pads().length === 2; }, null, 40000);
  await host.evaluate(() => { document.querySelectorAll('.ig-title').forEach(e => e.remove()); window.__GAME.S.mode = 'party'; window.__GAME.start({ mode: 'party' }); });
  await host.waitForTimeout(600);
  const drawer = await host.evaluate(() => window.__GAME.G.drawer.slot);
  const dPad = drawer === 1 ? p1 : p2, gPad = drawer === 1 ? p2 : p1;
  await wait(dPad, () => /Draw|Dibuja/.test(document.getElementById('msg').textContent), null, 8000);
  log('drawer phone:', await dPad.$eval('#msg', e => e.textContent.replace(/\n/g, ' ')));
  await host.evaluate(() => document.querySelector('.ig-screen [data-a=go]').click());
  await wait(gPad, () => !document.getElementById('choices').hidden, null, 8000);
  await shot(gPad, 'draw_guess');
  const idx = await host.evaluate(() => window.__GAME.G.opts.indexOf(window.__GAME.G.word));
  await gPad.locator('#copts button').nth(idx).dispatchEvent('pointerdown');
  await wait(host, () => window.__GAME.G.phase === 'reveal', null, 8000);
  log('draw scores', await host.evaluate(() => window.__GAME.G.players.map(p => p.name + ':' + p.score).join(' ')));
};
