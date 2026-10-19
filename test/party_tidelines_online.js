// Tide Lines online on separate screens (roadmap R7): a friend opens games/tidelines.html?join=CODE, takes over a painter
// on the host's team and plays on their own screen. The host simulates; the guest sends stick/aim/spray and renders the
// host's match from snapshots (paint strokes replayed in order + a full floor every 2 s). Checks: the guest's painter moves
// and paints on the host, the guest's floor matches the host's, the match ends on both and the guest gets its own results.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const init = () => { try { localStorage.setItem('inoa.profile', JSON.stringify({ lang: 'en', voice: false })); } catch (e) { } };
  const host = await open('games/tidelines.html?online=1', { label: 'host', init, w: 640, h: 360 }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim());
  const link = await host.$eval('.inoa-pp .online .url', e => e.textContent.trim()); log('room', code, 'online link', link);
  if (!/tidelines\.html\?join=/.test(link)) throw new Error('party panel has no online link');
  const g = await open('games/tidelines.html?join=' + code, { label: 'guest', init, w: 640, h: 360 }); await ready(g);
  await wait(g, () => /You're in/.test(document.querySelector('.ig-room')?.textContent || ''), null, 60000);
  await host.click('.inoa-pp [data-x]');
  await host.evaluate(() => { const G = window.__GAME; G.setSkill('chill'); G.setMap('pier'); G.setMode('turf'); G.startMatch(); });
  const hostStep = n => host.evaluate(n => { for (let j = 0; j < n; j++) window.__GAME.update(1 / 20); }, n);
  await hostStep(4);
  log('host units', await host.evaluate(() => JSON.stringify({ players: window.__GAME.units.map(u => (u.netSlot || 0) + (u.online ? 'o' : '')).join(','), role: window.__GAME.net && window.__GAME.net.role })));
  await wait(g, () => window.__GAME.G && window.__GAME.G.client, null, 30000);
  const info = await g.evaluate(() => { const G = window.__GAME.G; return { units: window.__GAME.units.length, me: window.__GAME.units.indexOf(G.me), team: G.me.team, name: G.me.name }; });
  const onHost = await host.evaluate(() => window.__GAME.units.map((u, i) => u.online ? i : -1).filter(i => i >= 0));
  log('guest', JSON.stringify(info), 'host online units', JSON.stringify(onHost));
  if (info.units !== 8 || onHost.length !== 1 || onHost[0] !== info.me) throw new Error('guest is not driving the right painter');
  // countdown, then the guest walks and sprays
  for (let i = 0; i < 8; i++) { await hostStep(10); await host.waitForTimeout(40); }
  const before = await host.evaluate(i => { const u = window.__GAME.units[i]; return { x: u.x, z: u.z, painted: u.painted }; }, info.me);
  await g.keyboard.down('KeyW'); await g.keyboard.down('Space');
  for (let i = 0; i < 12; i++) { await hostStep(6); await host.waitForTimeout(80); }
  await g.keyboard.up('KeyW'); await g.keyboard.up('Space');
  const after = await host.evaluate(i => { const u = window.__GAME.units[i]; return { x: u.x, z: u.z, painted: u.painted, ink: u.ink }; }, info.me);
  log('guest painter on the host', JSON.stringify(before), '→', JSON.stringify(after));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 1.5) throw new Error('guest painter did not move on the host');
  if (!(after.painted > before.painted)) throw new Error('guest painter did not paint on the host');
  for (let i = 0; i < 20; i++) { await hostStep(5); await host.waitForTimeout(60); } // let a full-floor sync arrive
  await g.waitForTimeout(500);
  const [hc, gc] = [await host.evaluate(() => window.__GAME.pct()), await g.evaluate(() => window.__GAME.pct())];
  log('turf host', hc.map(v => v.toFixed(1)).join('/'), 'guest', gc.map(v => v.toFixed(1)).join('/'));
  if (Math.abs(hc[0] - gc[0]) > 3 || Math.abs(hc[1] - gc[1]) > 3) throw new Error('guest floor differs from the host');
  await g.evaluate(() => window.__GAME.updateCamera(1)); await shot(g, 'guest_match'); await host.evaluate(() => window.__GAME.updateCamera(1)); await shot(host, 'host_match');
  // end the match on the host: the guest gets the judge + its own results
  await host.evaluate(() => { window.__GAME.G.time = .05; }); await hostStep(3);
  for (let i = 0; i < 60; i++) { await g.evaluate(() => { for (let j = 0; j < 10; j++) window.__GAME.update(1 / 20); }); if (await g.evaluate(() => !!document.querySelector('.ig-results'))) break; await g.waitForTimeout(100); }
  const res = await g.evaluate(() => document.querySelector('.ig-results h2')?.textContent || null); log('guest results:', res);
  if (!res) throw new Error('guest did not get results');
  await shot(g, 'guest_results');
};
