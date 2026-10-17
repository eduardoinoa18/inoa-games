// Bubble Pop Counting headless test: title (big targets), the parent gate (a quick tap is blocked, press-and-hold + the grown-up
// sum opens it; Hub link, settings and ⌂ are gated), all four stages (real taps on the canvas for stage 1, hooks for the rest),
// gentle misses (no game over, adaptive ease + hint), results + profile XP once per set, Pop party, keyboard cursor + Space,
// gamepad stick + A, pause, high contrast, the save (no personal data) and a Spanish run (numbers spoken in Spanish).
// Screenshots: test/out/bubbles_<name>.png (portrait runs: _p suffix).
const path = require('path');
module.exports = async (p, _shot) => {
  const vp = p.viewportSize(); const SUF = vp.height > vp.width ? '_p' : '';
  const shot = n => p.screenshot({ path: path.join(__dirname, 'out', 'bubbles_' + n + SUF + '.png'), timeout: 180000 });
  const sim = sec => p.evaluate(async sec => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => window.__GAME.state);
  const log = (k, v) => console.log(k, JSON.stringify(v));
  const fails = []; const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('FAIL', msg); } };
  const hooks = (lang = 'en') => p.evaluate(lang => { window.__said = []; try { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.voice = true; pr.lang = lang; localStorage.setItem('inoa.profile', JSON.stringify(pr)); } catch (e) { } if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text); }, lang);
  const said = () => p.evaluate(() => window.__said.slice());
  const profile = () => p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); return { xp: pr.xp || 0, coins: pr.coins || 0, plays: pr.games && pr.games.bubbles ? pr.games.bubbles.plays : 0 }; });
  await p.evaluate(() => { localStorage.removeItem('inoa.bubbles'); });
  await hooks('en'); await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await hooks('en'); await p.waitForTimeout(400);

  /* ---- title ---- */
  const t0 = await p.evaluate(() => ({ stages: document.querySelectorAll('.bp-stage').length, party: !!document.querySelector('.bp-party'), min: window.__GAME.minTargetPx(), hscroll: document.documentElement.scrollWidth > innerWidth + 1 }));
  log('title', t0); check(t0.stages === 4 && t0.party && t0.min >= 64 && !t0.hscroll, 'title: 4 stages + Pop party, targets ≥ 64 px, no horizontal scroll');
  await shot('title');

  /* ---- parent gate ---- */
  const url0 = p.url();
  await p.click('.ig-title a[href]'); await p.waitForTimeout(250);
  check(p.url() === url0 && await p.evaluate(() => !!document.querySelector('.kd-gate .kd-hold')), 'Hub link opens the parent gate instead of leaving');
  await shot('gate');
  const hb = await p.evaluate(() => { const r = document.querySelector('.kd-gate .kd-hold').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  check(hb.w >= 64, 'gate hold button is big');
  await p.mouse.move(hb.x, hb.y); await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(500);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate .kd-hold') && !document.querySelector('.kd-gate-q')), 'a quick tap does not open the gate');
  await p.click('.kd-gate [data-g=x]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => !document.querySelector('.kd-gate')) && p.url() === url0, 'closing the gate stays in the game');
  // settings button: gated too
  await p.click('.ig-title [data-a=settings]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate') && !document.querySelector('.ig-settings')), 'settings are behind the parent gate');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // grown-ups panel: hold 1.7 s, then answer the sum (one wrong answer first: a new question, still closed)
  await p.click('#bpGrown'); await p.waitForTimeout(200);
  const hb2 = await p.evaluate(() => { const r = document.querySelector('.kd-gate .kd-hold').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(hb2.x, hb2.y); await p.mouse.down(); await p.waitForTimeout(1800); await p.mouse.up(); await p.waitForTimeout(200);
  const q1 = await p.evaluate(() => (document.querySelector('.kd-gate-q') || {}).textContent || '');
  check(/\d+ \+ \d+/.test(q1), 'after holding, a grown-up sum is asked: ' + q1);
  await shot('gate_sum');
  const answer = async (right) => p.evaluate(right => { const [a, b] = document.querySelector('.kd-gate-q').textContent.match(/\d+/g).map(Number); const btns = [...document.querySelectorAll('.kd-gate [data-g=opt]')]; const t = btns.find(x => (+x.dataset.v === a + b) === right); t.click(); }, right);
  await answer(false); await p.waitForTimeout(150);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate-q') && !document.getElementById('bpGrownPanel')), 'a wrong sum keeps the gate closed (new question)');
  await answer(true); await p.waitForTimeout(250);
  check(await p.evaluate(() => !document.querySelector('.kd-gate') && !!document.getElementById('bpGrownPanel')), 'the right sum opens the grown-ups panel');
  await shot('grownups');
  // high contrast on (bubbles + card redraw), checked in play later; links inside the unlocked panel are not gated twice
  await p.click('#bpGrownPanel [data-o=hc]'); await p.waitForTimeout(100);
  check(await p.evaluate(() => document.documentElement.classList.contains('kd-hc') && window.__GAME.S.hc === true), 'high contrast toggles');
  await p.click('#bpGrownPanel [data-a=settings]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => !!document.querySelector('.ig-settings') && !document.querySelector('.kd-gate')), 'settings open from the unlocked panel without a second gate');
  await p.click('.ig-settings [data-a=done]'); await p.click('#bpGrownPanel [data-a=close]'); await p.waitForTimeout(200);
  log('gate', await p.evaluate(() => window.__GAME.gate()));

  /* ---- stage 1 with real taps (high contrast on for this stage) ---- */
  const before = await profile();
  await p.click('.bp-stage[data-stage="0"]'); await p.waitForTimeout(300); await sim(.3);
  let s = await st(); log('s1start', s); check(s.mode === 'play' && s.stage === 0 && s.pi === 0, 'tapping a stage tile starts it');
  check((await said()).some(t => /count to three/i.test(t)) && (await said()).some(t => /^Pop (one|two|three) bubbles?!$/.test(t)), 'stage intro + "Pop N bubbles!" spoken');
  const minPx = await p.evaluate(() => window.__GAME.minBubblePx()); log('bubblePx', minPx); check(minPx >= 64, 'bubbles are at least 64 px on screen');
  check(await p.evaluate(() => window.__GAME.minTargetPx()) >= 64, 'repeat button ≥ 64 px');
  await shot('s1_hc');
  await p.click('.bp-card .kd-repeat'); await p.waitForTimeout(100);
  check((await said()).slice(-1)[0] === await p.evaluate(() => window.__GAME.lastLine()), 'repeat button speaks the instruction again');
  const tap = async (correct) => { const v = await p.evaluate(c => window.__GAME.ensure(c), correct); if (!v) return false; await p.mouse.click(v.x, v.y); await p.waitForTimeout(60); return true; };
  let guard = 0, missed = false, taps = 0;
  while ((await st()).mode === 'play' && guard++ < 60) {
    s = await st();
    if (s.between > 0) { await sim(.5); continue; }
    if (s.kind === 'find' && !missed) { const m0 = s.misses; await tap(false); s = await st(); check(s.misses === m0 + 1 && s.mode === 'play', 'a wrong tap is a gentle miss (no game over)'); missed = true; const sd = await said(); log('missLine', sd.slice(-1)); check(/Look for the number/.test(sd.slice(-1)[0] || ''), 'miss: encouraging line + hint spoken'); await shot('s1_miss'); continue; }
    const p0 = s.popped; await tap(true); taps++; s = await st();
    if (s.kind === 'count' && s.need > 1 && p0 === 0) check(s.popped === 1 || s.between > 0, 'real tap pops a bubble');
    await sim(.15);
  }
  const sd1 = await said(); log('s1said', sd1.slice(0, 14));
  check(sd1.some(t => /^Two!$/.test(t)) || sd1.some(t => /^Two! You popped two/.test(t)), 'pops are counted aloud');
  check(sd1.some(t => /You found it/.test(t)), 'find prompt success line');
  s = await st(); log('s1end', s); check(s.mode === 'reward', 'set of 5 ends in the reward');
  await sim(1); await p.waitForTimeout(1500); await shot('s1_reward');
  await sim(2.8); await p.waitForTimeout(200);
  const r1 = await p.evaluate(() => ({ results: !!document.querySelector('.ig-results'), again: (document.querySelector('.ig-results [data-a=again]') || {}).textContent, min: Math.min(...[...document.querySelectorAll('.ig-results .ig-btn')].map(b => b.getBoundingClientRect().height)) }));
  log('results1', r1); check(r1.results && r1.min >= 64, 'results card with big buttons');
  const after = await profile(); log('profile', { before, after }); check(after.xp > before.xp && after.plays === before.plays + 1, 'results paid XP to the shared profile once');
  await shot('s1_results');
  // results Hub button is gated
  await p.click('.ig-results [data-a=hub]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate')) && p.url() === url0, 'results Hub button is behind the parent gate');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { window.__GAME.S.hc = false; document.documentElement.classList.remove('kd-hc'); });

  /* ---- stages 2–4 through hooks ---- */
  const runStage = async (i, name) => {
    await p.evaluate(i => window.__GAME.startStage(i), i); await p.waitForTimeout(250); await sim(.4);
    const kinds = []; let g = 0, shotDone = false;
    while ((await st()).mode === 'play' && g++ < 40) { const ss = await st(); if (ss.between > 0) { await sim(.6); continue; } const pr = await p.evaluate(() => window.__GAME.prompt()); kinds.push([pr.kind, pr.answer, pr.text]); if (!shotDone) { await sim(1.2); await shot(name); shotDone = true; }
      for (let k = 0; k < pr.need && (await st()).between <= 0; k++) { await p.evaluate(() => window.__GAME.popCorrect()); await sim(.1); } }
    log(name, kinds); return kinds;
  };
  // stage 3 (never a 'count' prompt): two misses on one prompt → easier (ease up) and the right bubble gets a hint glow
  await p.evaluate(() => window.__GAME.startStage(2)); await p.waitForTimeout(200); await sim(.4);
  const e0 = (await st()).ease; await p.evaluate(() => { window.__GAME.popWrong(); }); await sim(.1); await p.evaluate(() => { window.__GAME.popWrong(); }); await sim(.2);
  const hint = await p.evaluate(() => window.__GAME.bubbles().filter(b => b.correct).map(b => b.hint)); s = await st(); log('adapt', { e0, e1: s.ease, hint, misses: s.misses });
  check(s.misses === 2 && s.mode === 'play' && s.ease > e0 && hint.length > 0 && hint.every(Boolean), 'two misses: gentler (ease up) and the matching bubble glows');
  const k2 = await runStage(1, 's2');
  check(k2.some(k => k[0] === 'stars' && /with \w+ stars?/.test(k[2])), 'stage 2 asks for star groups');
  await sim(3.8); await p.evaluate(() => document.querySelectorAll('.ig-screen').forEach(e => e.remove()));
  const k3 = await runStage(2, 's3');
  check(k3.some(k => k[0] === 'matchQ') && k3.some(k => k[0] === 'matchN' && /How many/.test(k[2])), 'stage 3 matches numerals and groups both ways');
  await sim(3.8); await p.evaluate(() => document.querySelectorAll('.ig-screen').forEach(e => e.remove()));
  const k4 = await runStage(3, 's4');
  check(k4.every(k => k[0] === 'more' && k[1] >= 2 && k[1] <= 10 && /one more/.test(k[2])), 'stage 4: "one more" sums up to 10');
  await sim(3.8);
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.bubbles')));
  log('save', sv); check(sv && sv.v === 1 && sv.stars.s1 >= 2 && sv.stars.s4 >= 2 && sv.stickers.length >= 4 && !('name' in sv), 'save holds stars + stickers only');
  await p.evaluate(() => document.querySelectorAll('.ig-screen').forEach(e => e.remove()));

  /* ---- keyboard: arrows move a soft cursor, Space pops ---- */
  await p.evaluate(() => window.__GAME.startStage(0)); await p.waitForTimeout(200); await sim(.3);
  const steer = async (kind) => {
    const tgt = await p.evaluate(() => window.__GAME.ensure(true)); if (!tgt) return false; let locked = false;
    for (let k = 0; k < 40 && !locked; k++) {
      const c = await p.evaluate(() => window.__GAME.cursor()); const b = (await p.evaluate(() => window.__GAME.bubbles())).find(x => x.i === tgt.i); if (!b) return false;
      if (c.on && c.lock === tgt.i) { locked = true; break; }
      const dx = b.x - (c.on ? c.x : vp.width / 2), dy = b.y - (c.on ? c.y : vp.height * .6);
      if (kind === 'key') { const keys = []; if (Math.abs(dx) > 20) keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(dy) > 20) keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp'); if (!keys.length) keys.push('ArrowUp'); for (const kk of keys) await p.keyboard.down(kk); await sim(.06); for (const kk of keys) await p.keyboard.up(kk); }
      else { await p.evaluate(([x, y]) => { window.__pad.axes = [x, y]; }, [Math.abs(dx) > 20 ? Math.sign(dx) * .8 : 0, Math.abs(dy) > 20 ? Math.sign(dy) * .8 : 0]); await sim(.05); await p.evaluate(() => { window.__pad.axes = [0, 0]; }); }
      await sim(.05);
    }
    return locked ? tgt.i : false;
  };
  const kp0 = (await st()).pops; const lockK = await steer('key'); log('keyLock', lockK);
  await p.keyboard.down('Space'); await sim(.05); await p.keyboard.up('Space'); await sim(.05);
  check(lockK !== false && (await st()).pops === kp0 + 1, 'keyboard: arrows steer the cursor onto a bubble, Space pops it');
  await shot('keyboard');
  /* ---- gamepad (same path phones use): stick + A ---- */
  await p.evaluate(() => { const btn = () => ({ pressed: false, value: 0 }); window.__pad = { id: 'test pad', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) }; navigator.getGamepads = () => [window.__pad]; });
  await sim(.6);
  const gp0 = (await st()).pops; const lockG = await steer('pad'); log('padLock', lockG);
  await p.evaluate(() => { window.__pad.buttons[0] = { pressed: true, value: 1 }; }); await sim(.05); await p.evaluate(() => { window.__pad.buttons[0] = { pressed: false, value: 0 }; }); await sim(.05);
  check(lockG !== false && (await st()).pops === gp0 + 1, 'gamepad: stick steers, A pops');
  await p.evaluate(() => { navigator.getGamepads = () => []; });
  /* ---- pause: Esc opens the pause menu; its Hub + settings are gated ---- */
  await p.keyboard.down('Escape'); await sim(.05); await p.keyboard.up('Escape'); await p.waitForTimeout(150);
  check((await st()).paused && await p.evaluate(() => !!document.querySelector('.ig-screen [data-a=resume]')), 'Esc pauses');
  await p.click('.ig-screen [data-a=hub]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate')) && p.url() === url0, 'pause menu Hub is gated');
  await p.keyboard.press('Escape'); await p.click('.ig-screen [data-a=resume]'); await p.waitForTimeout(100);
  check(!(await st()).paused, 'resume');
  await p.click('.ig-home'); await p.waitForTimeout(150);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate')) && p.url() === url0, 'the ⌂ home chip is gated');
  await p.keyboard.press('Escape');

  /* ---- Pop party ---- */
  await p.evaluate(() => window.__GAME.title()); await p.waitForTimeout(150);
  await p.click('.bp-party'); await p.waitForTimeout(250); await sim(.8);
  s = await st(); check(s.mode === 'party', 'Pop party starts');
  for (let k = 0; k < 12; k++) { await p.evaluate(() => { const b = window.__GAME.bubbles()[0] || window.__GAME.ensure(false); window.__GAME.popIndex(b.i); }); await sim(.12); }
  s = await st(); const ps = await said(); log('party', { s, last: ps.slice(-4) }); check(s.pops === 12 && s.partyN === 2 && ps.some(t => /Ten! Hooray/.test(t)), 'party counts every pop aloud and celebrates ten');
  await shot('party');
  const pb = await profile(); await p.click('.bp-done'); await p.waitForTimeout(250);
  check(await p.evaluate(() => !!document.querySelector('.ig-results')) && (await profile()).xp > pb.xp, 'All done ends the party with results + XP');

  /* ---- Spanish ---- */
  await hooks('es'); await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await hooks('es'); await p.waitForTimeout(300);
  const esT = await p.evaluate(() => document.querySelector('.ig-title').innerText);
  check(/Fiesta de burbujas/.test(esT) && /Cuenta hasta 3/.test(esT) && /Adultos/.test(esT), 'title in Spanish');
  await shot('es_title');
  await p.click('.bp-stage[data-stage="0"]'); await p.waitForTimeout(250); await sim(.3);
  for (let k = 0; k < 4; k++) { const pr = await p.evaluate(() => window.__GAME.prompt()); if (pr.kind === 'count' && pr.need >= 2) break; await p.evaluate(() => window.__GAME.popCorrect()); await sim(2.6); }
  const pr = await p.evaluate(() => window.__GAME.prompt());
  for (let k = 0; k < pr.need; k++) { await p.evaluate(() => window.__GAME.popCorrect()); await sim(.1); }
  const es = await said(); log('esSaid', es.slice(0, 12));
  check(es.some(t => /contar hasta tres/.test(t)) && es.some(t => /^¡(Revienta|Busca)/.test(t)), 'Spanish instructions spoken');
  check(pr.kind !== 'count' || pr.need < 2 || es.some(t => /^(Uno|Dos)!|^¡(Dos|Tres)!/.test(t) || /Reventaste/.test(t)), 'numbers counted in Spanish');
  await sim(.6); await shot('es_play');

  console.log(fails.length ? `BUBBLES_FAIL ${fails.length}` : 'BUBBLES_OK');
  if (fails.length) throw new Error('bubbles checks failed: ' + fails.join(' | '));
};
