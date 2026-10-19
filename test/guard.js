// Page guard (engine/guard.js): a game that crashes every frame, loses its WebGL context, or can't load its scripts shows a
// friendly Reload / Hub screen instead of a frozen page; older-Safari polyfills are present.
// usage: node test/run.js bubbles test/guard.js
module.exports = async (p, shot) => {
  await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  const poly = await p.evaluate(() => typeof CanvasRenderingContext2D.prototype.roundRect === 'function' && typeof window.__inoaReport === 'function');
  // 1) an error that repeats → "the game got stuck"
  await p.evaluate(() => { for (let i = 0; i < 3; i++) dispatchEvent(new ErrorEvent('error', { message: 'guard test ' + i, error: new Error('guard test ' + i) })); }); // same path as an uncaught error, without failing the harness
  await p.waitForTimeout(400);
  const stuck = await p.evaluate(() => document.querySelector('.inoa-guard h2')?.textContent || null);
  await shot('guard_stuck');
  // 2) WebGL context lost without a restore → "the graphics took a break"
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost')));
  await p.waitForTimeout(1900);
  const lost = await p.evaluate(() => document.querySelector('.inoa-guard h2')?.textContent || null);
  await shot('guard_webgl');
  // 3) the 3D library can't download (network blocks the CDN) → the boot screen explains it
  const ctx = await p.context().browser().newContext({ serviceWorkers: 'block' }); const q = await ctx.newPage();
  await q.route(/vendor\/three\//, r => r.abort()); await q.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await q.goto(p.url().replace(/\?.*$/, ''), { waitUntil: 'domcontentloaded' }).catch(() => { });
  await q.waitForTimeout(9500);
  const boot = await q.evaluate(() => (document.querySelector('.inoa-guard') || {}).innerText || null);
  await q.screenshot({ path: 'test/out/guard_boot.png' });
  await ctx.close();
  console.log('guard', JSON.stringify({ poly, stuck, lost, boot: boot && boot.split('\n')[1] }));
  if (!poly || !stuck || !lost || !boot) { console.log('GUARD_FAILED'); process.exitCode = 1; } else console.log('GUARD_OK');
};
