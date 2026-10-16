// Snack Squad Safari — full feature test (prints SAFARI_CHECKS_PASSED when every check holds).
// Covers: v2 save migration -> profiles, title (EN + ES), setup (profiles, avatar, allergens, toggles), level picker (10 levels),
// every level briefly (themes + weather), duo scanner, label read (EN + ES, zoom, detective mode), keyboard lanes,
// friend offer (neutral icons), themed offer, menu moment, mystery snack, pause (toggles, big text, high contrast),
// unsafe catch -> full 3D rescue cutscene (EN) + Spanish drill card run, level end -> results (one reward), sticker book.
// Uses window.__AA (legacy hook) + window.__GAME. Set PFX=before_ to prefix screenshot names.
module.exports = async (p, shot) => {
  const PFX = process.env.PFX || '';
  const fails = []; const check = (name, ok, extra = '') => { console.log('[safari]', ok ? 'ok  ' : 'FAIL', name, extra); if (!ok) fails.push(name); };
  const snap = async (n, wait = 500) => { await p.waitForTimeout(wait); await shot(PFX + n); };
  const sim = (sec) => p.evaluate(async (sec) => { const up = window.__GAME.update; for (let i = 0; i < sec * 60; i++) { up(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const log = (...a) => console.log('[safari]', ...a);
  const hidden = id => p.evaluate(id => document.getElementById(id).hidden, id);
  const click = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.click(); }, sel);
  const text = sel => p.evaluate(sel => (document.querySelector(sel) || {}).textContent || '', sel);

  // ---------- save migration: an old single-player v2 save becomes player 1 ----------
  await p.evaluate(() => { localStorage.setItem('snacksquad', JSON.stringify({ v: 2, name: 'Ana', allergens: ['egg', 'sesame'], duo: false, sound: true, motion: true, stars: [3, 2, 0, 0, 0], collection: [{ n: 'Golden Mango Pop', e: '🥭', r: 3 }], lang: 'en', voice: false })); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  const mig = await p.evaluate(() => { const S = window.__GAME.S; return { n: S.profiles.length, name: S.name, al: S.allergens.join(), stars: S.stars.join(), col: S.collection.length }; });
  check('v2 save migrates to player 1', mig.n === 1 && mig.name === 'Ana' && mig.al === 'egg,sesame' && mig.stars === '3,2,0,0,0,0,0,0,0,0' && mig.col === 1, JSON.stringify(mig));

  // helpers inside the page: force an item of a given kind into the player's lane
  await p.evaluate(() => {
    const A = window.__AA; A.S.voice = false; A.S.allergens = ['peanut', 'milk'];
    window.__T = {
      clear() { for (const it of A.G.items.slice()) { A.scene.remove(it.mesh); A.G.items.splice(A.G.items.indexOf(it), 1); } },
      force(test, z) { for (let n = 0; n < 400; n++) { A.spawn(); const it = A.G.items[A.G.items.length - 1]; if (test(it)) { it.lane = A.G.lane; it.z = z; it.mesh.position.set([-2.6, 0, 2.6][it.lane], .35, z); return it; } A.scene.remove(it.mesh); A.G.items.pop(); } return null; },
    };
  });

  // ---------- title, language ----------
  await snap('title', 200);
  check('title shows the practice-game note', /not medical advice/.test(await text('#scrTitle .note')));
  await click('#btnLang'); await snap('title_es', 300);
  check('title in Spanish', /no es consejo médico/.test(await text('#scrTitle .note')) && /A jugar/.test(await text('#btnPlay')));
  await click('#btnHow'); check('How it works in Spanish', /amiguito/.test(await text('#scrHow .learn'))); await snap('how_es', 200); await click('#btnHowBack');
  await click('#btnLang');

  // ---------- setup: profiles, avatar, rider, allergens, toggles ----------
  await click('#btnPlay'); await snap('setup', 300);
  await click('#btnAddProf');
  await p.fill('#kidName', 'Leo');
  await p.evaluate(() => { const box = document.getElementById('allergens'); const chip = n => [...box.children].find(b => b.textContent.includes(n)); chip('Peanut').click(); chip('Shellfish').click(); document.querySelectorAll('#avatars .av')[3].click(); document.querySelectorAll('#avatars .rider')[1].click(); });
  const prof = await p.evaluate(() => { const S = window.__GAME.S; return { n: S.profiles.length, cur: S.cur, name: S.name, al: S.allergens.join(), av: S.avatar, kid: S.kid }; });
  check('new player has own name + allergens + look', prof.n === 2 && prof.cur === 1 && prof.name === 'Leo' && prof.al === 'milk,shellfish' && prof.av === '🐢' && prof.kid === 'skater-male', JSON.stringify(prof));
  await snap('setup_profiles', 200);
  await p.evaluate(() => document.querySelectorAll('#profiles .prof')[0].click());
  check('switch back to player 1 keeps her list', await p.evaluate(() => window.__GAME.S.allergens.join() === 'peanut,milk'));
  await p.evaluate(() => document.querySelectorAll('#profiles .prof')[1].click());
  await click('#btnDelProf'); await click('#btnDelProf');
  check('remove player (two taps)', await p.evaluate(() => window.__GAME.S.profiles.length === 1));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('snacksquad')));
  check('save is v3 with profiles', saved.v === 3 && Array.isArray(saved.profiles) && saved.profiles.length === 1, 'v=' + saved.v);
  await p.evaluate(() => { const A = window.__AA; A.S.allergens = ['peanut', 'milk']; });
  await click('#btnSetupGo'); await snap('levels', 300);
  const lv = await p.evaluate(() => ({ n: document.querySelectorAll('#levels .lv').length, locked: document.querySelectorAll('#levels .lv.lock').length }));
  check('level picker lists 10 levels', lv.n === 10, JSON.stringify(lv));

  // ---------- each level briefly (themes; weather visible on 4 + 5) ----------
  for (let i = 0; i < 10; i++) {
    await p.evaluate((i) => { const A = window.__AA; A.S.duo = false; A.startLevel(i); A.G.nextOfferAt = 999; for (let k = 0; k < 8; k++) A.spawn(); }, i);
    await sim(1.2);
    const st = await p.evaluate(() => { const A = window.__AA; let w = 0; A.scene.traverse(o => { if (o.isPoints && o.userData.kind) w++; }); return { lv: A.G.level, scene: A.G.scene, items: A.G.items.length, weather: w, theme: window.__GAME.state().theme }; });
    log('level', i + 1, JSON.stringify(st));
    if (i === 3 || i === 4) check('weather on level ' + (i + 1), st.weather === 1);
    check('level ' + (i + 1) + ' plays', st.scene === 'play' && st.items > 0);
    await snap('lv' + (i + 1));
  }
  check('hub chip hidden while playing', await p.evaluate(() => getComputedStyle(document.querySelector('.inoa-home')).display === 'none'));

  // ---------- keyboard lanes ----------
  const lane0 = await p.evaluate(() => window.__AA.G.lane);
  await p.keyboard.down('ArrowLeft'); await sim(.1); await p.keyboard.up('ArrowLeft');
  check('keyboard moves a lane', await p.evaluate(l => window.__AA.G.lane === l - 1, lane0));

  // ---------- duo mode: grown-up pushes, scanner beam ----------
  await p.evaluate(() => { const A = window.__AA; A.S.duo = true; A.startLevel(1); A.G.nextOfferAt = 999; for (let k = 0; k < 6; k++) A.spawn(); });
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })));
  await sim(1);
  check('scanner beam on Shift (duo)', await p.evaluate(() => window.__AA.G.scan) && !(await hidden('scan')));
  check('team sticker', await p.evaluate(() => window.__GAME.S.stickers.includes('team')));
  await snap('duo_scanner');
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' })));
  await p.evaluate(() => { window.__AA.S.duo = false; });

  // ---------- label read (EN), zoom, then answer ----------
  const lbl = await p.evaluate(() => { const A = window.__AA; window.__T.clear(); const it = window.__T.force(x => x.kind === 'pack', -10); A.tryRead(); return { name: it && it.name, unsafe: it && it.unsafe, paused: A.G.paused }; });
  check('label opens and pauses', !(await hidden('scrLabel')) && lbl.paused, JSON.stringify(lbl));
  check('label lists INGREDIENTS', /INGREDIENTS:/.test(await text('#lblBox')));
  await snap('label', 300);
  await click('#lblBox'); check('tap zooms the label', await p.evaluate(() => document.getElementById('lblBox').classList.contains('zoom'))); await snap('label_zoom', 200);
  await p.evaluate((u) => window.__AA.answerLabel(!u), lbl.unsafe);
  check('label answered + label1 sticker', await p.evaluate(() => window.__AA.G.labels === 1 && window.__GAME.S.stickers.includes('label1')) && await hidden('scrLabel'));

  // ---------- label in Spanish + detective mode (no highlights) ----------
  await p.evaluate(() => { const A = window.__AA; A.S.lang = 'es'; window.__GAME.applyLang(); window.__T.clear(); window.__T.force(x => x.kind === 'pack' && x.label.contains.includes('milk') && x.label.hiddenUsed.length === 0, -10); A.tryRead(); });
  const esl = await text('#lblBox');
  check('label in Spanish', /INGREDIENTES:/.test(esl) && /CONTIENE: LECHE/.test(esl), esl.slice(0, 120));
  check('allergen highlighted (hints on)', await p.evaluate(() => document.querySelectorAll('#lblBox mark').length > 0));
  await snap('label_es', 300);
  await p.evaluate(() => { const G = window.__GAME; G.S.hints = false; document.getElementById('lblBox').innerHTML = G.labelHTML(window.__AA.G.items.find(i => i.kind === 'pack')); });
  check('detective mode: no highlights', await p.evaluate(() => document.querySelectorAll('#lblBox mark').length === 0));
  await p.evaluate(() => { const G = window.__GAME; G.S.hints = true; window.__AA.answerLabel(false); G.S.lang = 'en'; G.applyLang(); });

  // ---------- friend offer (level 2): neutral icons ----------
  await p.evaluate(() => { const A = window.__AA; A.S.duo = false; A.startLevel(1); A.G.nextOfferAt = 0.05; });
  await sim(.2);
  check('offer shown', !(await hidden('scrOffer')));
  const icons = await p.evaluate(() => [...document.querySelectorAll('#offChoices .ic')].map(x => x.textContent).join(''));
  check('offer icons do not reveal the answer', icons === 'ABC', icons);
  await snap('offer', 300);
  await p.evaluate(() => [...document.querySelectorAll('#offChoices button')].find(x => x.dataset.good === '1').click());
  check('good choice -> ask sticker, game resumes', await p.evaluate(() => window.__GAME.S.stickers.includes('ask') && !window.__AA.G.paused));

  // ---------- themed offer (school) + menu moments (school lunch line, restaurant) ----------
  await p.evaluate(() => { const G = window.__GAME; G.start(5); G.G.moments = ['o']; G.G.nextOfferAt = 0.05; });
  await sim(.2);
  const offT = await text('#offTitle'); check('school level offers a school moment', /lunch|trail mix|Cupcakes/i.test(offT), offT);
  await p.evaluate(() => [...document.querySelectorAll('#offChoices button')].find(x => x.dataset.good === '1').click());
  await p.evaluate(() => { const G = window.__GAME; G.start(9); G.G.nextOfferAt = 0.05; });
  check('restaurant opens with a menu', await p.evaluate(() => window.__GAME.G.moments[0] === 'm'));
  await sim(.2);
  const menu = await p.evaluate(() => ({ title: document.getElementById('offTitle').textContent, n: document.querySelectorAll('#offChoices button').length, ask: [...document.querySelectorAll('#offChoices .ic')].some(x => x.textContent === '🙋'), safe: [...document.querySelectorAll('#offChoices button')].filter(b => b.dataset.good === '1').length }));
  check('menu: 3 dishes + ask a grown-up, at least one safe dish', menu.n === 4 && menu.ask && menu.safe >= 2, JSON.stringify(menu));
  await snap('menu', 300);
  await p.evaluate(() => [...document.querySelectorAll('#offChoices button')].find(x => x.dataset.good === '1' && !x.textContent.includes('🙋')).click());
  check('safe dish -> menu sticker', await p.evaluate(() => window.__GAME.S.stickers.includes('menu')));

  // ---------- mystery snack ----------
  await p.evaluate(() => { const A = window.__AA; A.startLevel(1); A.G.nextOfferAt = 999; window.__T.clear(); A.G.paused = false; A.G.got = 9; A.G.nextMystery = 10; A.G.drilled = true; window.__T.force(x => x.kind === 'food' && !x.unsafe, -.5); });
  await sim(.1);
  check('mystery shown', !(await hidden('scrMystery')));
  await snap('mystery', 300);
  await click('#btnMysOk');

  // ---------- pause: toggles, big text, high contrast ----------
  await click('#btnPause'); check('pause shown', !(await hidden('scrPause')));
  await p.evaluate(() => { document.querySelector('#scrPause [data-t=big]').click(); document.querySelector('#scrPause [data-t=hc]').click(); });
  check('big text + high contrast classes', await p.evaluate(() => document.body.classList.contains('big') && document.body.classList.contains('hc')));
  await snap('pause_a11y', 300);
  await p.evaluate(() => { document.querySelector('#scrPause [data-t=big]').click(); document.querySelector('#scrPause [data-t=hc]').click(); });
  await click('#btnResume');

  // ---------- unsafe catch -> rescue cutscene, step by step (EN) ----------
  const rescue = async (tag) => {
    await sim(2.5); await snap('rescue1_symptoms' + tag);
    await click('#drillA'); await sim(1.5); await snap('rescue2_help' + tag);
    await p.waitForTimeout(2800); // drill UI reveals the hold button after 2.6 s
    check('hold step' + tag, !(await hidden('drillB')) && await p.evaluate(() => window.__AA.R.phase === 'pen'));
    await sim(2.2);
    await p.evaluate(() => document.getElementById('drillB').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await p.waitForTimeout(1500); await snap('rescue3_pen' + tag, 0);
    await p.waitForTimeout(2200);
    check('auto-injector step done' + tag, await p.evaluate(() => document.getElementById('st2').classList.contains('done')));
    await p.waitForTimeout(2600); // phone + dial appear after 2.2 s
    check('dial step' + tag, !(await hidden('dial')) && await p.evaluate(() => window.__AA.R.phase === 'call'));
    await sim(.5); await snap('rescue4_dial' + tag, 0);
    await p.evaluate(() => { for (const k of ['9', '1', '1']) [...document.querySelectorAll('#dial .dialBtn')].find(b => b.textContent === k).click(); });
    check('call button' + tag, !(await hidden('drillC')));
    await click('#drillC');
    await p.waitForTimeout(5600); // then the plan moves on to "lie down + ambulance"
    check('lie-down phase' + tag, await p.evaluate(() => window.__AA.R.phase === 'lie'));
    await sim(5); await snap('rescue5_ambulance' + tag);
    await p.waitForTimeout(5200);
    check('wait-together button' + tag, !(await hidden('drillD')));
    await click('#drillD'); await p.waitForTimeout(700);
    const done = await p.evaluate(() => ({ active: window.__AA.R.active, paused: window.__AA.G.paused, drill: document.getElementById('scrDrill').hidden, rescueClass: document.body.classList.contains('rescue') }));
    check('rescue done, play resumes' + tag, !done.active && !done.paused && done.drill && !done.rescueClass, JSON.stringify(done));
  };
  await p.evaluate(() => { const A = window.__AA; A.startLevel(0); window.__T.clear(); window.__T.force(x => x.kind === 'food' && x.unsafe, -.5); });
  await sim(.05);
  check('drill shown on first unsafe catch', !(await hidden('scrDrill')) && await p.evaluate(() => window.__AA.R.phase === 'symptoms'));
  check('lane controls hidden during rescue', await p.evaluate(() => getComputedStyle(document.querySelector('#hud .bottom')).visibility === 'hidden'));
  await rescue('');
  check('rescue sticker', await p.evaluate(() => window.__GAME.S.stickers.includes('rescue')));
  await sim(.5); await snap('after_rescue');

  // ---------- level end -> results (exactly one reward) ----------
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile') || '{}'));
  await p.evaluate(() => { const A = window.__AA; window.__T.clear(); A.G.paused = false; A.G.got = A.LEVELS[A.G.level].goal - 1; A.G.nextMystery = 999; window.__T.force(x => x.kind === 'food' && !x.unsafe, -.5); });
  await sim(.1);
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile') || '{}'));
  const g0 = (before.games || {}).safari || { plays: 0 }, g1 = (after.games || {}).safari || { plays: 0 };
  log('results', JSON.stringify({ scene: await p.evaluate(() => window.__AA.G.scene), plays: [g0.plays, g1.plays], xp: [before.xp || 0, after.xp || 0], best: g1.best }));
  check('exactly one reward per level end', g1.plays - g0.plays === 1);
  check('results show stars, learned, new stickers, next level', await p.evaluate(() => !!document.getElementById('resStars') && !!document.getElementById('resLearn') && !!document.getElementById('resStickers') && !!document.getElementById('btnNext')));
  check('level sticker', await p.evaluate(() => window.__GAME.S.stickers.includes('lv0')));
  await snap('results', 300);

  // ---------- sticker book ----------
  await click('#btnResBook'); await p.waitForTimeout(200);
  const book = await p.evaluate(() => ({ shown: !document.getElementById('scrBook').hidden, n: document.querySelectorAll('#book .stk-b').length, got: document.querySelectorAll('#book .stk-b.got').length }));
  check('sticker book lists stickers + earned ones', book.shown && book.n >= 29 && book.got >= 5, JSON.stringify(book));
  await p.evaluate(() => document.querySelector('#book .stk-b.got').click());
  await snap('book', 300);
  await click('#btnBookBack');
  check('book returns to the level picker', !(await hidden('scrLevels')));

  // ---------- Spanish rescue drill card (new ES translations, pending review) ----------
  await p.evaluate(() => { const A = window.__AA; A.S.lang = 'es'; window.__GAME.applyLang(); A.startLevel(1); A.G.nextOfferAt = 999; window.__T.clear(); window.__T.force(x => x.kind === 'food' && x.unsafe, -.5); });
  await sim(.05);
  check('drill card in Spanish', /autoinyector de epinefrina/.test(await text('#st2')) && /Rescate del amiguito/.test(await text('#drillTitle')));
  await rescue('_es');
  await p.evaluate(() => { window.__AA.S.lang = 'en'; window.__GAME.applyLang(); });

  const hasGame = await p.evaluate(() => !!(window.__GAME && window.__GAME.update && window.__GAME.start) && window.__READY === true);
  check('__GAME hooks + __READY', hasGame);
  console.log(fails.length ? '[safari] FAILED CHECKS: ' + fails.join(' | ') : 'SAFARI_CHECKS_PASSED');
};
