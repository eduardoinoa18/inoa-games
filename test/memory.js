// Memory Match headless test: title (5 modes, no scroll), Little ones (Kids World shell: big cards ≥ 96 px, picture names spoken,
// parent gate on ⌂ / grown-ups / results Hub, no timer, sticker reward), Words in both directions (picture ↔ word and EN ↔ ES,
// each word spoken in its own language), Classic on all three grids (real taps on Easy incl. a miss, hooks for the rest, best
// scores), Daily board determinism across two page loads + one counted attempt + streak + resume, Two players turn passing,
// keyboard (arrows + Space) and gamepad (stick + A) flips, results + profile XP once, the save (no names) and a Spanish run.
// Every grid size is checked to fit the viewport (no scroll, cards ≥ 64 px). Screenshots: test/out/memory_<name>.png (_p portrait).
const path = require('path');
module.exports = async (p) => {
  const vp = p.viewportSize(); const SUF = vp.height > vp.width ? '_p' : '';
  const shot = n => p.screenshot({ path: path.join(__dirname, 'out', 'memory_' + n + SUF + '.png'), timeout: 180000 });
  const sim = sec => p.evaluate(async sec => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => window.__GAME.state);
  const log = (k, v) => console.log(k, JSON.stringify(v));
  const fails = []; const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('FAIL', msg); } };
  const hooks = (lang = 'en') => p.evaluate(lang => { window.__said = []; try { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.voice = true; pr.lang = lang; localStorage.setItem('inoa.profile', JSON.stringify(pr)); } catch (e) { } if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push({ t: u.text, l: u.lang }); }, lang);
  const said = () => p.evaluate(() => window.__said.slice());
  const saidText = async () => (await said()).map(x => x.t);
  const profile = () => p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); return { xp: pr.xp || 0, coins: pr.coins || 0, plays: pr.games && pr.games.memory ? pr.games.memory.plays : 0 }; });
  const reload = async (lang = 'en') => { await hooks(lang); await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await hooks(lang); await p.waitForTimeout(300); };
  const cards = () => p.evaluate(() => window.__GAME.cards());
  const clear = () => p.evaluate(() => document.querySelectorAll('.ig-screen,.kd-reward').forEach(e => e.remove()));
  // the board must fit: inside the viewport, no page scroll, every card at least minPx wide
  const fits = async (name, minPx) => {
    const b = await p.evaluate(() => window.__GAME.board()); const cs = await cards(); const s = await st();
    const inside = cs.every(c => c.x - c.w / 2 >= -1 && c.x + c.w / 2 <= b.vw + 1 && c.y - c.h / 2 >= -1 && c.y + c.h / 2 <= b.vh + 1);
    const top = await p.evaluate(() => document.querySelector('.ig-top').getBoundingClientRect().bottom);
    const belowHud = cs.every(c => c.y - c.h / 2 >= top - 1);
    const minW = Math.min(...cs.map(c => Math.min(c.w, c.h)));
    log('fit_' + name, { n: s.n, cols: s.cols, rows: s.rows, w: s.cardW, h: s.cardH, minW: Math.round(minW), inside, belowHud, scroll: [b.sw, b.sh, b.vw, b.vh] });
    check(inside && belowHud && minW >= minPx && b.sw <= b.vw + 1 && b.sh <= b.vh + 1, `${name}: ${s.n} cards fit the screen below the HUD, no scroll, cards ≥ ${minPx} px (got ${Math.round(minW)})`);
  };
  // flip two face-down cards that do / don't match, by real taps on their screen positions
  const tapCard = async (i) => { const c = (await cards())[i]; await p.mouse.click(c.x, c.y); await p.waitForTimeout(40); };
  const tapPair = async () => { const cs = await cards(); const a = cs.find(c => c.state === 'down'); if (!a) return false; const b = cs.find(c => c.i !== a.i && c.state === 'down' && c.id === a.id); await tapCard(a.i); await tapCard(b.i); await sim(.1); return true; };
  const tapMiss = async () => { const cs = await cards(); const a = cs.find(c => c.state === 'down'); const b = cs.find(c => c.i !== a.i && c.state === 'down' && c.id !== a.id); await tapCard(a.i); await tapCard(b.i); return [a.i, b.i]; };
  const peek = async (k = 2) => { const cs = await cards(); const ids = [...new Set(cs.filter(c => c.state === 'down').map(c => c.id))].slice(0, k); await p.evaluate(ids => { const g = window.__GAME; for (const id of ids) { const cs = g.cards().filter(c => c.id === id && c.state === 'down'); if (cs.length === 2) { g.flip(cs[0].i); g.flip(cs[1].i); } } }, ids); await settle(); };
  // headless Chromium only advances CSS transitions while frames are requested (the 3D table renders on demand): spin rAF for a moment
  // (software rendering makes those frames slow): spin rAF until every card flip has finished, at most ~10 s
  const settle = (ms = 400) => p.evaluate(ms => new Promise(r => { const t0 = performance.now(); const f = () => { const busy = document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.mm-board')); if ((busy || performance.now() - t0 < ms) && performance.now() - t0 < 10000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }), ms);
  const showOne = async () => { const cs = await cards(); const a = cs.find(c => c.state === 'down'); await p.evaluate(i => window.__GAME.flip(i), a.i); await settle(); }; // one face up for the screenshot

  await p.evaluate(() => { localStorage.removeItem('inoa.memory'); localStorage.removeItem('inoa.profile'); });
  await reload('en');

  /* ---- title ---- */
  const t0 = await p.evaluate(() => ({ modes: [...document.querySelectorAll('.mm-mode')].map(b => b.dataset.m), hscroll: document.documentElement.scrollWidth > innerWidth + 1, title: document.querySelector('.ig-title h1').textContent }));
  log('title', t0); check(t0.modes.join() === 'kids,words,classic,daily,duo' && !t0.hscroll, 'title: five modes, no horizontal scroll');
  await shot('title');

  /* ---- Little ones (Kids World shell) ---- */
  await p.click('.mm-mode[data-m=kids]'); await p.waitForTimeout(100);
  await shot('title_kids');
  await p.click('.ig-title [data-a=play]'); await p.waitForTimeout(300);
  let s = await st(); check(s.mode === 'kidsHome', 'Play on Little ones opens the kids picture menu');
  const kh = await p.evaluate(() => ({ themes: document.querySelectorAll('.mm-kt').length, sizes: [...document.querySelectorAll('.mm-kn')].map(b => +b.dataset.n), min: window.__GAME.minTargetPx(), gate: window.__GAME.gate() }));
  log('kidsHome', kh); check(kh.themes === 6 && kh.sizes.join() === '4,6,8' && kh.min >= 64 && kh.gate.enabled, 'kids menu: 6 picture themes, 4/6/8 cards, big targets, parent gate on');
  check((await saidText()).some(t => /Pick a picture to play/.test(t)), 'kids menu instruction read aloud');
  await shot('kids_home');
  // parent gate: ⌂ is gated, a quick tap does not open it
  const url0 = p.url();
  await p.click('.mm-kt[data-theme=nature]'); await p.waitForTimeout(300); await sim(.2);
  await p.click('.ig-home'); await p.waitForTimeout(250);
  check(p.url() === url0 && await p.evaluate(() => !!document.querySelector('.kd-gate .kd-hold')), 'kids: ⌂ opens the parent gate instead of leaving');
  const hb = await p.evaluate(() => { const r = document.querySelector('.kd-gate .kd-hold').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  await p.mouse.move(hb.x, hb.y); await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(400);
  check(await p.evaluate(() => !!document.querySelector('.kd-gate .kd-hold') && !document.querySelector('.kd-gate-q')), 'kids: a quick tap does not open the gate');
  await p.click('.kd-gate [data-g=x]'); await p.waitForTimeout(150);
  check(p.url() === url0 && await p.evaluate(() => !document.querySelector('.kd-gate')), 'kids: closing the gate stays in the game');
  await p.evaluate(() => window.__GAME.kidsHome()); await p.waitForTimeout(150);
  // grown-ups: hold, then the sum → panel (high contrast + all modes live here)
  await p.click('#mmGrown'); await p.waitForTimeout(200);
  const hb2 = await p.evaluate(() => { const r = document.querySelector('.kd-gate .kd-hold').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(hb2.x, hb2.y); await p.mouse.down(); await p.waitForTimeout(1800); await p.mouse.up(); await p.waitForTimeout(200);
  await p.evaluate(() => { const [a, b] = document.querySelector('.kd-gate-q').textContent.match(/\d+/g).map(Number); [...document.querySelectorAll('.kd-gate [data-g=opt]')].find(x => +x.dataset.v === a + b).click(); });
  await p.waitForTimeout(200);
  check(await p.evaluate(() => !document.querySelector('.kd-gate') && !!document.getElementById('mmGrownPanel')), 'kids: hold + the right sum opens the grown-ups panel');
  await shot('kids_grownups');
  await p.click('#mmGrownPanel [data-a=close]'); await p.waitForTimeout(100);
  // play every Little ones size; 6 cards by real taps
  for (const n of [4, 6, 8]) {
    await p.evaluate(n => { window.__GAME.S.kids.n = n; window.__GAME.kidsHome(); }, n); await p.waitForTimeout(150);
    await p.click(`.mm-kt[data-theme=${n === 4 ? 'animals' : n === 6 ? 'food' : 'colors'}]`); await p.waitForTimeout(300); await sim(.2);
    s = await st(); check(s.mode === 'kids' && s.n === n, `kids: tapping a picture starts ${n} cards`);
    await fits('kids' + n, 96);
    check(!(await p.evaluate(() => !!document.getElementById('mmTime'))) && await p.evaluate(() => window.__GAME.minTargetPx()) >= 64, `kids ${n}: no timer, repeat button big`);
    await showOne(); await sim(.5); await shot('kids' + n);
    await p.evaluate(() => window.__GAME.resolve());
  }
  await p.evaluate(() => { window.__GAME.S.kids.n = 6; window.__GAME.kidsHome(); }); await p.waitForTimeout(150);
  const pk0 = await profile();
  await p.click('.mm-kt[data-theme=animals]'); await p.waitForTimeout(300); await sim(.2); await hooks('en');
  const [m1, m2] = await tapMiss(); s = await st();
  check(s.open.length === 2 && s.wait > 1, 'kids: two different pictures stay up a while (no penalty)');
  const sdk = await saidText(); log('kidsSaid', sdk); check(sdk.filter(t => /^[A-Z][a-z]+( [a-z]+)?!$/.test(t)).length >= 2, 'kids: each flipped picture is named aloud');
  await tapCard(3); s = await st(); check(s.open.length === 2, 'kids: a third tap waits until the cards turn back');
  await sim(1.8); s = await st(); check(s.open.length === 0 && s.matched === 0 && !s.done, 'kids: the two cards turn back gently');
  while ((await st()).matched < 3) await tapPair();
  s = await st(); check(s.done, 'kids: all pairs found by real taps');
  await sim(1); await settle(1500); await shot('kids_reward');
  await sim(3.4); await p.waitForTimeout(200);
  const kr = await p.evaluate(() => ({ results: !!document.querySelector('.ig-results'), btn: Math.min(...[...document.querySelectorAll('.ig-results .ig-btn')].map(b => b.getBoundingClientRect().height)) }));
  const pk1 = await profile(); log('kidsResults', { kr, pk0, pk1 });
  check(kr.results && kr.btn >= 64 && pk1.xp > pk0.xp && pk1.plays === pk0.plays + 1, 'kids: reward, then results with big buttons; XP paid once');
  await shot('kids_results');
  await p.click('.ig-results [data-a=hub]'); await p.waitForTimeout(200);
  check(p.url() === url0 && await p.evaluate(() => !!document.querySelector('.kd-gate')), 'kids: results Hub is behind the parent gate');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const sv0 = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.memory')));
  check(sv0.kids.stickers.length === 1 && sv0.kidsHome === true, 'kids: sticker saved; the page reopens on the kids menu');
  // reopen lands on the kids menu; leaving to all modes goes through the gate
  await reload('en'); s = await st(); check(s.mode === 'kidsHome', 'reload: Little ones menu comes back');
  await p.evaluate(() => { window.__GAME.title(); }); await p.waitForTimeout(150);
  check(!(await p.evaluate(() => window.__GAME.gate().enabled)), 'grown-up title: parent gate off outside Little ones');

  /* ---- Words: picture ↔ word (Spanish words), then English ↔ Spanish ---- */
  await p.evaluate(() => { const S = window.__GAME.S; S.words = { theme: 'animals', dir: 'pic', lang: 'es', n: 12 }; window.__GAME.title(); }); await p.waitForTimeout(150);
  await p.click('.mm-mode[data-m=words]'); await p.waitForTimeout(100); await shot('title_words');
  await p.click('.ig-title [data-a=play]'); await p.waitForTimeout(300); await sim(.2); await hooks('en');
  s = await st(); let cs = await cards();
  check(s.mode === 'words' && s.n === 12 && cs.filter(c => c.f === 'pic').length === 6 && cs.filter(c => c.f === 'es').length === 6, 'words (picture ↔ word): 6 pictures + 6 Spanish words');
  await fits('words12', 64);
  const pc = cs.find(c => c.f === 'pic'); await tapCard(pc.i); let sw = await said(); log('wordsPicSaid', sw.slice(-1));
  check(sw.length && sw[sw.length - 1].l === 'es-US', 'words: a picture card speaks its Spanish word');
  const wpair = cs.find(c => c.i !== pc.i && c.id === pc.id); await tapCard(wpair.i); await sim(.1);
  s = await st(); sw = await said(); check(s.matched === 1 && sw.some(x => x.l === 'en-US') && sw.some(x => x.l === 'es-US'), 'words: matching picture + word reads both words (EN + ES voices)');
  check(/=/.test(await p.evaluate(() => document.getElementById('cap').textContent)), 'words: caption shows the pair (English = Spanish)');
  await peek(2); await sim(.2); await shot('words12_pic');
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2);
  check(await p.evaluate(() => !!document.querySelector('.ig-results')), 'words: results at the end');
  await shot('words_results'); await clear();
  await p.evaluate(() => window.__GAME.start('words', { dir: 'lang', n: 16, theme: 'food' })); await p.waitForTimeout(250); await sim(.2); await hooks('en');
  cs = await cards(); s = await st();
  check(s.n === 16 && cs.filter(c => c.f === 'en').length === 8 && cs.filter(c => c.f === 'es').length === 8 && cs.every(c => c.f !== 'pic'), 'words (EN ↔ ES): 8 English + 8 Spanish word cards');
  await fits('words16', 64);
  const en = cs.find(c => c.f === 'en'), es = cs.find(c => c.f === 'es' && c.id === en.id);
  await tapCard(en.i); await tapCard(es.i); sw = await said(); log('wordsLangSaid', sw.slice(0, 4));
  check(sw[0] && sw[0].l === 'en-US' && sw[1] && sw[1].l === 'es-US' && (await st()).matched === 1, 'words EN ↔ ES: each card speaks in its own language and they match');
  await peek(3); await sim(.2); await shot('words16_lang');
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2); await clear();

  /* ---- Classic: Easy by real taps (with a miss), Medium + Hard by hooks ---- */
  await p.waitForTimeout(3200); // the engine ignores a second reward for the same game within 3 s (a test finishes boards faster than people)
  const pc0 = await profile();
  await p.evaluate(() => { window.__GAME.S.classic.g = 'e'; window.__GAME.title(); }); await p.waitForTimeout(150);
  await p.click('.mm-mode[data-m=classic]'); await p.click('.ig-title [data-a=play]'); await p.waitForTimeout(300); await sim(.2);
  s = await st(); check(s.mode === 'classic' && s.n === 12 && s.time === 0, 'classic Easy: 12 cards, clock waits for the first flip');
  await fits('classic12', 64);
  await tapMiss(); s = await st(); check(s.moves === 1 && s.open.length === 2 && s.combo === 0, 'classic: a miss counts one move');
  await sim(.4); const tm = (await st()).time; check(tm > .3, 'classic: the clock runs after the first flip');
  // a third tap turns the two back at once (grown-up modes)
  const third = (await cards()).find(c => c.state === 'down' && !(s.open.includes(c.i))); await tapCard(third.i); s = await st();
  check(s.open.length === 1 && s.open[0] === third.i, 'classic: a third tap turns the last two back and flips the new one');
  await p.evaluate(i => { const g = window.__GAME; g.flip(g.pairOf(i)); }, third.i); await sim(.1);
  for (let k = 0; k < 2; k++) await tapPair();
  s = await st(); log('combo', s); check(s.combo >= 2, 'classic: matches in a row build a combo');
  await sim(.3); await settle(); await shot('classic12');
  while ((await st()).matched < 6) await tapPair();
  await sim(1.2);
  const cr = await p.evaluate(() => ({ r: !!document.querySelector('.ig-results'), txt: (document.querySelector('.ig-results') || {}).innerText || '' }));
  const pc1 = await profile(); log('classicResults', { pc0, pc1, txt: cr.txt.slice(0, 160) });
  check(cr.r && /Moves/.test(cr.txt) && pc1.xp > pc0.xp && pc1.plays === pc0.plays + 1, 'classic: results with moves + time, XP paid once');
  await shot('classic_results');
  // the same results card does not pay twice (results again within the same board)
  for (const g of ['m', 'h']) {
    await clear(); await p.evaluate(g => window.__GAME.start('classic', { g }), g); await p.waitForTimeout(250); await sim(.2);
    const n = g === 'm' ? 20 : 30; s = await st(); check(s.n === n, `classic ${g}: ${n} cards`);
    await fits('classic' + n, 64); await peek(3); await showOne(); await sim(.5); await fits('classic' + n + '_combo', 64); await shot('classic' + n);
    await p.evaluate(() => window.__GAME.resolve()); await p.evaluate(() => window.__GAME.solve()); await sim(1.2);
    check(await p.evaluate(() => !!document.querySelector('.ig-results')), `classic ${g}: solved, results`);
  }
  const sv1 = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.memory'))); log('best', sv1.best);
  check(sv1.best.e && sv1.best.m && sv1.best.h && sv1.best.e.moves >= 6, 'classic: best scores saved for all three grids');
  await clear();

  /* ---- Daily board: deterministic, one counted attempt, streak, resume ---- */
  await p.evaluate(() => window.__GAME.setDate('2026-10-17'));
  const ids1 = await p.evaluate(() => window.__GAME.dailyIds('2026-10-17'));
  await p.evaluate(() => window.__GAME.start('daily')); await p.waitForTimeout(250); await sim(.2);
  const lay1 = (await cards()).map(c => c.id); s = await st();
  check(s.n === 20 && lay1.join() === ids1.join(), 'daily: 20 cards, laid out from the date seed');
  await fits('daily20', 64);
  await tapPair(); await tapMiss(); await sim(1.2); s = await st(); check(s.matched === 1 && s.moves === 2, 'daily: progress');
  await peek(2); await sim(.2); const dBefore = await st(); await showOne(); await sim(.5); await shot('daily20');
  // second page load, same date: same layout, and the attempt resumes where it was
  await reload('en'); await p.evaluate(() => window.__GAME.setDate('2026-10-17'));
  await p.evaluate(() => window.__GAME.start('daily')); await p.waitForTimeout(250); await sim(.2);
  const lay2 = (await cards()).map(c => c.id); s = await st(); log('daily', { same: lay1.join() === lay2.join(), s });
  check(lay1.join() === lay2.join(), 'daily: the same layout on a second page load (deterministic)');
  check(s.resumed && s.matched === dBefore.matched && s.moves >= dBefore.moves && s.matched >= 3, 'daily: the first attempt resumes (one attempt per day)');
  const other = await p.evaluate(() => window.__GAME.dailyIds('2026-10-18'));
  check(other.join() !== lay1.join(), 'daily: another date gives another board');
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2);
  let dsv = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.memory')).daily); log('dailySave', dsv);
  check(dsv.hist['2026-10-17'] && dsv.streak === 1 && dsv.last === '2026-10-17' && !dsv.cur, 'daily: result counted, streak 1');
  const dtxt = await p.evaluate(() => document.querySelector('.ig-results').innerText); check(/🔥 1/.test(dtxt) && await p.evaluate(() => !!document.querySelector('.ig-results [data-a=share]')), 'daily: results show the streak and a share line');
  await shot('daily_results'); await clear();
  const firstRes = dsv.hist['2026-10-17'];
  await p.evaluate(() => window.__GAME.start('daily')); await p.waitForTimeout(250); await sim(.2);
  s = await st(); check(s.practice && s.matched === 0, 'daily: a second try today is practice');
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2); await clear();
  dsv = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.memory')).daily);
  check(JSON.stringify(dsv.hist['2026-10-17']) === JSON.stringify(firstRes) && dsv.streak === 1, 'daily: practice does not change the counted result');
  await p.evaluate(() => window.__GAME.setDate('2026-10-18')); await p.evaluate(() => window.__GAME.start('daily')); await p.waitForTimeout(200); await sim(.2);
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2); await clear();
  dsv = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.memory')).daily); check(dsv.streak === 2 && dsv.bestStreak === 2, 'daily: next day keeps the streak (2)');
  await p.evaluate(() => window.__GAME.setDate(null));

  /* ---- Two players: a match keeps the turn, a miss passes it ---- */
  await p.evaluate(() => { window.__GAME.S.duo.n = 20; window.__GAME.title(); }); await p.waitForTimeout(150);
  await p.click('.mm-mode[data-m=duo]'); await p.waitForTimeout(80); await shot('title_duo');
  await p.click('.ig-title [data-a=play]'); await p.waitForTimeout(300); await sim(.2); await hooks('en');
  s = await st(); check(s.mode === 'duo' && s.turn === 0 && s.n === 20, 'two players: player 1 starts');
  await fits('duo20', 64);
  await tapPair(); s = await st(); check(s.turn === 0 && s.scores[0] === 1, 'two players: a match keeps the turn');
  await tapMiss(); await sim(1.2); s = await st(); check(s.turn === 1 && s.scores[1] === 0, 'two players: a miss passes the turn to player 2');
  check((await saidText()).some(t => /Player 2's turn/.test(t)), 'two players: the turn change is read aloud');
  await tapPair(); s = await st(); check(s.turn === 1 && s.scores[1] === 1, 'two players: player 2 scores and keeps the turn');
  await sim(.3); await settle(); await shot('duo20');
  await p.evaluate(() => window.__GAME.solve()); await sim(1.2);
  check(/Player|tie/.test(await p.evaluate(() => document.querySelector('.ig-results h2').textContent)), 'two players: results name the winner');
  await shot('duo_results'); await clear();
  await p.evaluate(() => window.__GAME.start('duo', { n: 30 })); await p.waitForTimeout(250); await sim(.2); await fits('duo30', 64); await clear();
  await p.evaluate(() => window.__GAME.start('duo', { n: 12 })); await p.waitForTimeout(250); await sim(.2); await fits('duo12', 64);

  /* ---- keyboard: arrows move the selection, Space flips ---- */
  await p.evaluate(() => window.__GAME.start('classic', { g: 'm' })); await p.waitForTimeout(250); await sim(.2);
  await p.keyboard.press('ArrowRight'); s = await st(); check(s.kbd, 'keyboard: an arrow shows the selection ring');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown'); s = await st(); const cols = s.cols;
  check(s.sel === 1 + cols, `keyboard: right + down moves the ring (sel ${s.sel}, cols ${cols})`);
  await p.keyboard.press('Space'); s = await st(); check(s.open.length === 1 && s.open[0] === 1 + cols, 'keyboard: Space flips the selected card');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); s = await st(); check((s.open.length === 2 || s.matched === 1) && s.moves === 1, 'keyboard: Enter flips too (one move)');
  await sim(.2); await settle(); await shot('keyboard');
  await sim(1.2);
  /* ---- gamepad (the same path phones use): stick + A ---- */
  await p.evaluate(() => { const btn = () => ({ pressed: false, value: 0 }); window.__pad = { id: 'test pad', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) }; navigator.getGamepads = () => [window.__pad]; });
  await p.evaluate(() => { window.__GAME.state; }); const sel0 = (await st()).sel;
  await p.evaluate(() => { window.__pad.axes = [0.9, 0]; }); await sim(.05); await p.evaluate(() => { window.__pad.axes = [0, 0]; }); await sim(.05);
  await p.evaluate(() => { window.__pad.axes = [0, 0.9]; }); await sim(.05); await p.evaluate(() => { window.__pad.axes = [0, 0]; }); await sim(.05);
  s = await st(); const selG = s.sel; log('padSel', { sel0, selG, cols: s.cols });
  check(selG === Math.min(19, sel0 + 1 + s.cols) || selG !== sel0, 'gamepad: stick moves the selection');
  const target = (await cards())[selG]; const wasDown = target.state === 'down';
  await p.evaluate(() => { window.__pad.buttons[0] = { pressed: true, value: 1 }; }); await sim(.05); await p.evaluate(() => { window.__pad.buttons[0] = { pressed: false, value: 0 }; }); await sim(.05);
  s = await st(); check(wasDown && s.open.includes(selG), 'gamepad: A flips the selected card');
  // D-pad
  await p.evaluate(() => { window.__pad.buttons[15] = { pressed: true, value: 1 }; }); await sim(.05); await p.evaluate(() => { window.__pad.buttons[15] = { pressed: false, value: 0 }; }); await sim(.05);
  check((await st()).sel === Math.min(19, selG + 1), 'gamepad: D-pad right moves the selection');
  await p.evaluate(() => { navigator.getGamepads = () => []; });
  /* ---- pause stops the clock ---- */
  await p.keyboard.down('Escape'); await sim(.05); await p.keyboard.up('Escape'); await p.waitForTimeout(100);
  const tp = (await st()).time; await sim(.5); s = await st();
  check(s.paused && s.time === tp && await p.evaluate(() => !!document.querySelector('.ig-screen [data-a=resume]')), 'Esc pauses and the clock stops');
  await p.click('.ig-screen [data-a=resume]'); await p.waitForTimeout(100);
  check(!(await st()).paused, 'resume');
  await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => { }), p.click('.ig-home')]); check(!/memory\.html/.test(p.url()), '⌂ in grown-up modes goes straight to the hub (no gate)');
  await p.goto(url0); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });

  /* ---- save: no names ---- */
  const sv = await p.evaluate(() => localStorage.getItem('inoa.memory')); log('save', sv.slice(0, 300));
  check(!/name/i.test(sv) && JSON.parse(sv).v === 1, 'save holds no names');

  /* ---- Spanish ---- */
  await reload('es'); await p.evaluate(() => window.__GAME.title()); await p.waitForTimeout(200);
  const esT = await p.evaluate(() => document.querySelector('.ig-title').innerText);
  check(/Peques/.test(esT) && /Palabras/.test(esT) && /Clásico/.test(esT) && /Tablero del día/.test(esT) && /Dos jugadores/.test(esT), 'title in Spanish');
  await shot('es_title');
  await p.evaluate(() => window.__GAME.start('kids', { theme: 'animals', n: 4 })); await p.waitForTimeout(250); await sim(.2); await hooks('es');
  const kc = (await cards())[0]; await tapCard(kc.i); const esS = await said(); log('esSaid', esS);
  check(esS.some(x => /^¡?[A-ZÁÉÍÓÚ][a-záéíóúñ]+( [a-z]+)?!$/.test(x.t) && x.l === 'es-US'), 'Spanish: Little ones names the picture in Spanish');
  check(/Carta 1/.test(kc.label) || /Carta/.test((await cards())[0].label), 'Spanish: card labels in Spanish');
  await sim(.3); await settle(); await shot('es_kids');
  await p.evaluate(() => window.__GAME.solve()); await sim(1); await sim(3.4); await p.waitForTimeout(150);
  check(/Parejas|Calcomanía/.test(await p.evaluate(() => (document.querySelector('.ig-results') || {}).innerText || '')), 'Spanish results');

  console.log(fails.length ? `MEMORY_FAIL ${fails.length}` : 'MEMORY_OK');
  if (fails.length) throw new Error('memory checks failed: ' + fails.join(' | '));
};
