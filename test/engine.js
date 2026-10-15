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
    { const T = E.THREE, cam = new T.PerspectiveCamera(); cam.position.set(0, 2, 10); const wall = new T.Mesh(new T.BoxGeometry(4, 4, 1), new T.MeshStandardMaterial()); wall.position.set(0, 2, 5); const side = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial()); side.position.set(8, 0, 0); const sc = new T.Scene(); sc.add(wall, side); sc.updateMatrixWorld(true);
      const occ = E.occluders([wall, side]); for (let i = 0; i < 120; i++) occ.update(cam, new T.Vector3(0, 1, 0), 1 / 60); out.occluders = { wall: +wall.material.opacity.toFixed(2), side: side.material.opacity }; }
    { const d = document.createElement('div'); d.className = 'ig-screen'; d.innerHTML = '<div class="ig-card"><button id="b1">A</button><button id="b2">B</button></div>'; document.body.appendChild(d); const nav = E.menuNav(); dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })); const f1 = document.activeElement.id; dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })); out.menuNav = [f1, document.activeElement.id]; nav.stop(); d.remove(); }
    out.floatTextReturns = !!E.floatText('x', 10, 10);
    return out;
  });
  console.log('engine', JSON.stringify(r));
  await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); E.settingsPanel(); });
  await p.waitForTimeout(300); await shot('settings_es');
  await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); document.querySelectorAll('.ig-settings').forEach(e => e.remove()); E.setSetting('lang', 'en'); E.pauseMenu({ onResume() { }, onRestart() { } }); });
  await p.waitForTimeout(300); await shot('pause_en');
};
