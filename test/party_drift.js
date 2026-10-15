// Online racing: host opens Island Drift with ?online=1, a friend opens the online link on another
// screen (drift.html?join=CODE), the host starts a Grand Prix, the friend steers their own kart
// (host-authoritative physics, 20 Hz snapshots), and gets their own results when they finish.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/drift.html?online=1', { label: 'host' }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim());
  const link = await host.$eval('.inoa-pp .online .url', e => e.textContent.trim()); log('room', code, 'online link', link);
  await shot(host, 'host_panel');
  const guest = await open('games/drift.html?join=' + code, { label: 'guest' }); await ready(guest);
  await wait(guest, () => /You're in/.test(document.querySelector('.ig-screen')?.textContent || ''), null, 30000);
  await shot(guest, 'guest_lobby');
  await host.click('.inoa-pp [data-x]');
  await wait(host, () => /online racer/.test(document.getElementById('drOnline')?.textContent || ''), null, 8000);
  log('host title:', await host.$eval('#drOnline', e => e.textContent));
  await host.evaluate(() => { window.__GAME.S.mode = 'gp'; document.querySelector('[data-a=play]').click(); });
  await wait(guest, () => window.__GAME.G && window.__GAME.G.client, null, 20000);
  log('guest roster', await guest.evaluate(() => window.__GAME.G.karts.map(k => k.def.name + (k.isPlayer ? '*' : '')).join(',')));
  const step = async n => { for (let i = 0; i < n; i += 15) { await host.evaluate(() => { for (let j = 0; j < 15; j++) window.__GAME.update(1 / 30); }); await host.waitForTimeout(40); } };
  await step(130); // countdown
  await guest.keyboard.down('ArrowLeft'); await guest.waitForTimeout(300);
  await step(90);
  const hs = await host.evaluate(() => { const k = window.__GAME.G.karts.find(k => k.remote); return { slot: k.remote, x: k.x, z: k.z, v: k.v, steer: k.steer, pad: JSON.stringify(window.__GAME.net.pad(k.remote)) }; });
  log('host sees remote kart', JSON.stringify(hs));
  await guest.keyboard.up('ArrowLeft');
  await guest.waitForTimeout(800);
  const gs = await guest.evaluate(() => { const k = window.__GAME.G.me; return { x: k.x, z: k.z, tx: k.tx, v: k.v, t: window.__GAME.G.t }; });
  log('guest own kart', JSON.stringify(gs));
  if (!(hs.v > 5)) throw new Error('remote kart not driving');
  if (Math.hypot(gs.tx - hs.x, 0) > 40) throw new Error('guest snapshot far from host state');
  await guest.evaluate(() => window.__GAME.updateCamera(1)); await shot(guest, 'guest_race'); await host.evaluate(() => window.__GAME.updateCamera(1)); await shot(host, 'host_race');
  // fast-forward the guest's kart to the finish line on the host
  await host.evaluate(() => { const g = window.__GAME, G = g.G, k = G.karts.find(k => k.remote), p = g.pts[790]; k.lap = 2; k.half = true; k.idx = 790; k.x = p.x; k.z = p.z; k.h = Math.atan2(g.pts[795].x - p.x, g.pts[795].z - p.z); k.v = 40; });
  await step(60);
  await wait(guest, () => !!document.querySelector('.ig-results'), null, 20000);
  log('guest results:', await guest.$eval('.ig-results h2', e => e.textContent));
  await shot(guest, 'guest_results');
};
