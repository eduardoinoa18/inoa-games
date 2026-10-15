// Engine contract test (runs on the junk page): profile migration, reward de-dupe, settings panel, ES strings, pooled particles, helpers.
// usage: node test/run.js junk test/engine.js   (and W=390 H=844 for portrait)
module.exports = async (p, shot) => {
  const r = await p.evaluate(async () => {
    const E = await import('/engine/inoa3d.js'); const out = {};
    localStorage.setItem('inoa.profile', JSON.stringify({ name: 'Old', xp: '250', coins: 12, games: { drift: { plays: 3, best: 90 } }, lang: 'en', voice: true, sound: true }));
    const p = E.profile(); out.migrated = { v: p.v, xp: p.xp, keptGame: p.games.drift.plays === 3, music: p.music, recent: Array.isArray(p.recent) };
    const a = E.reward('drift', { xp: 50, coins: 5, best: 80, bestLower: true }); const b = E.reward('drift', { xp: 50, coins: 5 });
    const p2 = E.profile(); out.dedupe = { first: a.xp, secondSame: b === a, xp: p2.xp, plays: p2.games.drift.plays, best: p2.games.drift.best, recent: p2.recent[0] };
    localStorage.setItem('inoa.profile', '{not json'); out.corrupt = E.profile().xp === 0;
    E.setSetting('lang', 'es'); out.es = [E.t('paused'), E.L('Hi', 'Hola'), E.L({ en: 'A', es: 'B' }), document.documentElement.lang];
    out.helpers = ['aimLimbs', 'attach', 'weaponPivot', 'orientTo', 'settingsPanel', 'ensureModels', 'reducedMotion'].filter(k => typeof E[k] !== 'function');
    const P = new E.Particles(new E.THREE.Scene()); for (let i = 0; i < 400; i++) P.burst(new E.THREE.Vector3(), { n: 20 }); P.update(.1); out.particles = { pools: Object.keys(P.pools).length, list: P.list.length, cap: P.cap };
    return out;
  });
  console.log('engine', JSON.stringify(r));
  await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); E.settingsPanel(); });
  await p.waitForTimeout(300); await shot('settings_es');
  await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); document.querySelectorAll('.ig-settings').forEach(e => e.remove()); E.setSetting('lang', 'en'); E.pauseMenu({ onResume() { }, onRestart() { } }); });
  await p.waitForTimeout(300); await shot('pause_en');
};
