// PWA / offline test (run with SW=1): hub registers the SW → open a game online → go offline → reload the game → still playable.
// usage: SW=1 node test/run.js index test/pwa.js
module.exports = async (p, shot) => {
  const log = (...a) => console.log('pwa', ...a);
  p.on('response', r => { if (r.status() >= 400) log('HTTP', r.status(), r.url()); });
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  log('sw ready', await p.evaluate(() => !!navigator.serviceWorker.controller));
  const base = p.url().replace(/index\.html.*$/, '');
  await p.goto(base + 'games/junk.html'); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  log('online game ready; controlled =', await p.evaluate(() => !!navigator.serviceWorker.controller));
  const keys = await p.evaluate(async () => { const out = {}; for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).length; return out; });
  log('caches', JSON.stringify(keys));
  await p.context().setOffline(true); global.__server.close(); global.__server.closeAllConnections(); // the server is gone: only the SW cache can answer now
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  log('OFFLINE reload ready:', await p.evaluate(() => window.__READY === true));
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]')?.click());
  await p.evaluate(async () => { for (let i = 0; i < 60; i++) window.__GAME.update(1 / 60); });
  await shot('offline_junk');
  await p.goto(base + 'index.html'); await p.waitForTimeout(800); log('offline hub title:', await p.title()); await shot('offline_hub');
  await p.goto(base + 'games/nope.html'); await p.waitForTimeout(500); log('offline unknown page:', await p.title());
};
