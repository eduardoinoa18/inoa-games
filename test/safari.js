// Snack Squad Safari — full feature test. Uses window.__AA (legacy hook, still supported) so the same
// script runs on the pre-migration and migrated builds. Set PFX=before_ to prefix screenshot names.
// Covers: title (EN + ES), setup, level picker, all 5 levels (weather), duo scanner, label read,
// friend offer, mystery snack, pause, unsafe catch -> full 3D rescue cutscene, level end -> results.
module.exports = async (p, shot) => {
  const PFX = process.env.PFX || '';
  const snap = async (n, wait = 700) => { await p.waitForTimeout(wait); await shot(PFX + n); };
  const sim = (sec) => p.evaluate(async (sec) => { const A = window.__AA; const up = (window.__GAME && window.__GAME.update) || A.update; for (let i = 0; i < sec * 60; i++) { up(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const log = (...a) => console.log('[safari]', ...a);
  // helpers inside the page: force an item of a given kind into the player's lane
  await p.evaluate(() => {
    const A = window.__AA; A.S.voice = false; A.S.allergens = ['peanut', 'milk'];
    window.__T = {
      clear() { for (const it of A.G.items.slice()) { A.scene.remove(it.mesh); A.G.items.splice(A.G.items.indexOf(it), 1); } },
      force(test, z) { for (let n = 0; n < 400; n++) { A.spawn(); const it = A.G.items[A.G.items.length - 1]; if (test(it)) { it.lane = A.G.lane; it.z = z; it.mesh.position.set([-2.6, 0, 2.6][it.lane], .35, z); return it; } A.scene.remove(it.mesh); A.G.items.pop(); } return null; },
    };
  });
  const hidden = id => p.evaluate(id => document.getElementById(id).hidden, id);
  const click = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.click(); }, sel);

  // ---------- title, language, setup, level picker ----------
  await snap('title', 200);
  await click('#btnLang'); await snap('title_es', 300); await click('#btnLang');
  await click('#btnPlay'); await snap('setup', 300);
  await click('#modeDuo'); await click('#modeSolo');
  await click('#btnSetupGo'); await snap('levels', 300);

  // ---------- each level briefly (weather visible on 4 + 5) ----------
  for (let i = 0; i < 5; i++) {
    await p.evaluate((i) => { const A = window.__AA; A.S.duo = false; A.startLevel(i); A.G.nextOfferAt = 999; for (let k = 0; k < 8; k++) A.spawn(); }, i);
    await sim(1);
    const st = await p.evaluate(() => { const A = window.__AA; let w = 0; A.scene.traverse(o => { if (o.isPoints && o.userData.kind) w++; }); return { lv: A.G.level, scene: A.G.scene, items: A.G.items.length, weather: w }; });
    log('level', i + 1, JSON.stringify(st));
    await snap('lv' + (i + 1));
  }

  // ---------- duo mode: grown-up pushes, scanner beam ----------
  await p.evaluate(() => { const A = window.__AA; A.S.duo = true; A.startLevel(1); A.G.nextOfferAt = 999; for (let k = 0; k < 6; k++) A.spawn(); });
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })));
  await sim(1);
  log('scan', await p.evaluate(() => window.__AA.G.scan), 'scanBtn hidden', await hidden('scan'));
  await snap('duo_scanner');
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' })));

  // ---------- label read ----------
  const lbl = await p.evaluate(() => { const A = window.__AA; window.__T.clear(); const it = window.__T.force(x => x.kind === 'pack', -10); A.tryRead(); return { name: it && it.name, unsafe: it && it.unsafe, paused: A.G.paused }; });
  log('label', JSON.stringify(lbl), 'modal hidden', await hidden('scrLabel'));
  await snap('label', 400);
  await p.evaluate((u) => window.__AA.answerLabel(!u), lbl.unsafe);
  log('after answer labels=', await p.evaluate(() => window.__AA.G.labels), 'modal hidden', await hidden('scrLabel'));

  // ---------- friend offer (level 2+) ----------
  await p.evaluate(() => { const A = window.__AA; A.S.duo = false; A.startLevel(1); A.G.nextOfferAt = 0.05; });
  await sim(.2);
  log('offer shown', !(await hidden('scrOffer')));
  await snap('offer', 300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#offChoices button')].find(x => x.querySelector('.ic').textContent.includes('💬')); b.click(); });

  // ---------- mystery snack ----------
  await p.evaluate(() => { const A = window.__AA; window.__T.clear(); A.G.paused = false; A.G.got = 9; A.G.nextMystery = 10; A.G.drilled = true; window.__T.force(x => x.kind === 'food' && !x.unsafe, -.5); });
  await sim(.1);
  log('mystery shown', !(await hidden('scrMystery')));
  await snap('mystery', 300);
  await click('#btnMysOk');

  // ---------- pause ----------
  await click('#btnPause'); log('pause shown', !(await hidden('scrPause'))); await snap('pause', 300); await click('#btnResume');

  // ---------- unsafe catch -> rescue cutscene, step by step ----------
  await p.evaluate(() => { const A = window.__AA; A.startLevel(0); window.__T.clear(); window.__T.force(x => x.kind === 'food' && x.unsafe, -.5); });
  await sim(.05);
  log('drill shown', !(await hidden('scrDrill')), 'rescue', await p.evaluate(() => window.__AA.R.phase));
  await sim(2.5); await snap('rescue1_symptoms');
  await click('#drillA'); await sim(1.5); await snap('rescue2_help');
  await p.waitForTimeout(2800); // drill UI reveals the hold button after 2.6 s
  log('hold visible', !(await hidden('drillB')), 'phase', await p.evaluate(() => window.__AA.R.phase));
  await sim(2.2);
  await p.evaluate(() => document.getElementById('drillB').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.waitForTimeout(1500); await snap('rescue3_pen', 0);
  await p.waitForTimeout(2200);
  log('st2 done', await p.evaluate(() => document.getElementById('st2').classList.contains('done')));
  await p.waitForTimeout(2600); // phone + dial appear after 2.2 s
  log('dial visible', !(await hidden('dial')), 'phase', await p.evaluate(() => window.__AA.R.phase));
  await sim(.5); await snap('rescue4_dial', 0);
  await p.evaluate(() => { for (const k of ['9', '1', '1']) [...document.querySelectorAll('#dial .dialBtn')].find(b => b.textContent === k).click(); });
  log('call btn visible', !(await hidden('drillC')));
  await click('#drillC');
  await p.waitForTimeout(5600); // then the plan moves on to "lie down + ambulance"
  log('phase', await p.evaluate(() => window.__AA.R.phase));
  await sim(5); await snap('rescue5_ambulance');
  await p.waitForTimeout(5200);
  log('lie btn visible', !(await hidden('drillD')));
  await snap('rescue6_wait', 0);
  await click('#drillD'); await p.waitForTimeout(700);
  log('rescue done', JSON.stringify(await p.evaluate(() => ({ active: window.__AA.R.active, paused: window.__AA.G.paused, drill: document.getElementById('scrDrill').hidden }))));
  await sim(.5); await snap('after_rescue');

  // ---------- level end -> results ----------
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile') || '{}'));
  await p.evaluate(() => { const A = window.__AA; window.__T.clear(); A.G.paused = false; A.G.got = A.LEVELS[A.G.level].goal - 1; A.G.nextMystery = 999; window.__T.force(x => x.kind === 'food' && !x.unsafe, -.5); });
  await sim(.1);
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile') || '{}'));
  const g0 = (before.games || {}).safari || { plays: 0 }, g1 = (after.games || {}).safari || { plays: 0 };
  log('results', JSON.stringify({ scene: await p.evaluate(() => window.__AA.G.scene), plays: [g0.plays, g1.plays], xp: [before.xp || 0, after.xp || 0], best: g1.best }));
  if (g1.plays - g0.plays !== 1) console.log('[safari] WARNING: expected exactly one reward per level end, got', g1.plays - g0.plays);
  await snap('results', 300);
  const hasGame = await p.evaluate(() => !!(window.__GAME && window.__GAME.update && window.__GAME.start));
  log('__GAME hooks', hasGame, '__READY', await p.evaluate(() => window.__READY === true));
};
