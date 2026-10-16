// Draw the Pact headless test: word list integrity + no repeats → party round (pass, peek, hints, auto-draw, someone guessed,
// reveal) → team mode (team guess + steal) → speed sketch saved to the gallery wall → telephone chain slideshow → daily doodle
// (streak, same-day replace) + gallery viewer + share card → guess the doodle (keyboard digits, gamepad) → real pointer checks
// (mouse + synthetic pen with pressure, palm rejection, two-finger undo, undo/redo, eraser, fill bucket, shapes, stickers, sizes,
// colours, pointercancel, resize/rotate) → gamepad + keyboard play-through in Spanish (language consistency of engine cards) →
// results-exactly-once checks for every mode.
// Screenshots: test/out/draw_<name>.png in landscape, draw_<name>_p.png when the run is portrait (W<H).
// DRAW_THUMB=1 also writes test/out/draw_thumb_src.png (tile art source).
module.exports = async (p) => {
  const vp0 = p.viewportSize(); const SUF = vp0.height > vp0.width ? '_p' : '';
  const fails = []; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  // rendering is skipped between screenshots (software GL is slow); shots render one fresh frame
  await p.evaluate(() => { window.__NORENDER = true; });
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__NORENDER = false; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/draw_' + n + SUF + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; window.__NORENDER = true; }); };
  const sim = (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } return g.G ? { phase: g.G.phase, t: g.G.timer && +g.G.timer.left.toFixed(1) } : null; }, sec);
  const g = (fn, arg) => p.evaluate(fn, arg);
  const plays = () => g(() => (JSON.parse(localStorage.getItem('inoa.profile') || '{}').games || {}).draw?.plays || 0);
  const nResults = () => g(() => document.querySelectorAll('.ig-results').length);
  const clean = () => g(() => { document.querySelectorAll('.ig-results, .ig-title, .ig-screen').forEach(e => e.remove()); });
  await shot('title');
  check(await g(() => { const r = document.querySelector('.ig-title [data-a=play]').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; }), 'title: Play button visible without scrolling');

  // ---- word list: size, EN/ES pairs, tags, uniqueness, no repeats
  const wl = await g(() => { const W = window.__GAME.WORDS, C = window.__GAME.CATS; const by = {}, bd = { 1: 0, 2: 0, 3: 0 }; let bad = 0; const en = new Set(), es = new Set(); let dupEn = 0, dupEs = 0;
    for (const w of W) { if (!w.en || !w.es || ![1, 2, 3].includes(w.d) || !C[w.c]) bad++; by[w.c] = (by[w.c] || 0) + 1; bd[w.d]++; const a = w.en.toLowerCase(), b = w.es.toLowerCase(); if (en.has(a)) dupEn++; if (es.has(b)) dupEs++; en.add(a); es.add(b); }
    return { n: W.length, by, bd, bad, dupEn, dupEs, cats: Object.keys(C).length }; });
  console.log('words', wl.n, JSON.stringify(wl.bd), JSON.stringify(wl.by));
  check(wl.n >= 500 && wl.bad === 0, `word list: ${wl.n} words, every one with EN, ES, difficulty and a known category`);
  check(wl.dupEn === 0 && wl.dupEs === 0, 'word list: every English and every Spanish word is unique (no two options read the same)');
  check(wl.bd[1] >= 150 && wl.cats >= 12 && Object.values(wl.by).every(n => n >= 15), 'word list: 150+ easy words, 12+ categories with 15+ words each');
  const rep = await g(() => { localStorage.removeItem('inoa.draw.recent'); const G = window.__GAME; Object.assign(G.S, { diff: 1, cat: 'animals' }); const used = [], seen = new Set(); let dup = 0; for (let i = 0; i < 40; i++) { const w = G.drawWord(used); if (seen.has(w.en)) dup++; seen.add(w.en); used.push(w); } const a = [...seen]; const fresh = G.wordPool().length - 40, s2 = new Set(); for (let i = 0; i < fresh; i++) s2.add(G.drawWord([]).en); const overlap = [...s2].filter(x => seen.has(x)).length; const cats = a.map(x => G.WORDS.find(w => w.en === x).c); Object.assign(G.S, { diff: 0, cat: 'all' }); return { dup, overlap, fresh, onlyAnimals: cats.every(c => c === 'animals') }; });
  check(rep.dup === 0 && rep.onlyAnimals, 'no repeats: 40 animal words in one session, all different, all animals');
  check(rep.overlap === 0 && rep.fresh > 0, `recent words are remembered across sessions: the next ${rep.fresh} words are all ones not drawn last session`);
  const opt = await g(() => { const G = window.__GAME; let ok = true; for (let i = 0; i < 60; i++) { const w = G.WORDS[(i * 37) % G.WORDS.length]; const o = G.options(w); if (o.length !== 4 || !o.includes(w) || new Set(o.map(x => x.en)).size !== 4 || new Set(o.map(x => x.es)).size !== 4) ok = false; } return ok; });
  check(opt, 'guess options: 4 different words (EN and ES), the answer always included');

  // ---- party: 3 players, 1 round, hints
  let pl0 = await plays();
  await g(() => { localStorage.removeItem('inoa.draw.gallery'); localStorage.removeItem('inoa.draw.daily'); document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'party', players: 3, rounds: 1, lang: 'en', diff: 1, cat: 'all', roundSec: 60, hints: true }); });
  await sim(.5); await shot('pass');
  await g(() => window.__GAME.next()); await sim(.3); await shot('peek');
  await g(() => window.__GAME.next()); await sim(.5);
  const word0 = await g(() => window.__GAME.G.word.en);
  const h0 = await g(() => window.__GAME.hint());
  await g(() => window.__GAME.autoDraw(9)); await sim(5); await shot('drawing');
  const letters = [...word0].filter(c => /\p{L}/u.test(c)).length;
  check(h0.replace(/[^_]/g, '').length === letters, `hint: blanks match the word (${h0} for ${letters} letters)`);
  await sim(27); const h1 = await g(() => window.__GAME.hint()); check(h1.replace(/[^_]/g, '').length === letters - (letters >= 3 ? 1 : 0), `hint: one letter shows at half time (${h1})`);
  console.log('strokes', await g(() => window.__GAME.D.strokes.length));
  await g(() => window.__GAME.undo()); await g(() => window.__GAME.autoDraw(1));
  await g(() => window.__GAME.guessed(1)); console.log('reveal', JSON.stringify(await sim(2))); await shot('reveal');
  check(await g(() => window.__GAME.G.players[1].score === 2 && window.__GAME.G.players[0].score === 2), 'party: guess at half time = +2 for the guesser, +2 for the drawer');
  for (let t = 0; t < 2; t++) { await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(5)); if (t === 0) console.log('timeout', JSON.stringify(await sim(62))); else { await g(() => window.__GAME.guessed(0)); await sim(1.5); } }
  const pw = await g(() => window.__GAME.G.used.map(w => w.en)); check(new Set(pw).size === pw.length, 'party: no word repeats within the game');
  await g(() => window.__GAME.next()); await sim(1); await p.waitForTimeout(600); await shot('party_results');
  await g(() => { window.__GAME.next(); window.__GAME.next(); }); await sim(.5);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'party: E.results exactly once');

  // ---- teams: 4 players in Spanish, one team guess, one steal
  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'team', players: 4, rounds: 1, lang: 'es', roundSec: 45 }));
  await sim(.3); await shot('team_pass');
  check(await g(() => window.__GAME.G.teams.length === 2 && window.__GAME.G.players.map(p => p.team).join('') === '0101'), 'teams: 4 players split into 2 alternating teams');
  await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(4)); await sim(2); await shot('team_draw');
  await g(() => document.querySelector('#dwTools [data-a=got]').click()); await sim(1.5); await shot('team_reveal');
  check(await g(() => window.__GAME.G.teams[0].score === 3 && window.__GAME.G.phase === 'reveal'), 'teams: a quick team guess scores 3 for the drawer’s team');
  await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.3);
  await sim(46); check(await g(() => window.__GAME.G.phase === 'steal' && !!document.querySelector('[data-a=yes]')), 'teams: time up → the other team may steal'); await shot('team_steal');
  await g(() => document.querySelector('[data-a=yes]').click()); await sim(1.5);
  check(await g(() => window.__GAME.G.teams[0].score === 4), 'teams: a steal gives +1 to the other team');
  for (let t = 0; t < 2; t++) { await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.3); await sim(46); await g(() => document.querySelector('[data-a=no]')?.click()); await sim(1.5); }
  await g(() => window.__GAME.next()); await sim(1); await p.waitForTimeout(400); await shot('team_results');
  check(await plays() === pl0 + 1 && await nResults() === 1, 'teams: E.results exactly once');
  const teamRes = await g(() => document.querySelector('.ig-results').innerText); check(/Equipo Sol/.test(teamRes) && /Equipo Ola/.test(teamRes) && !/Team|Best drawer/.test(teamRes), 'teams (ES): results name both teams in Spanish');

  // ---- speed sketch: 5 prompts
  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'sketch', sketchSec: 20, lang: 'en' }));
  check(await g(() => /✏️/.test(document.querySelector('.ig-top').innerText) && !/Equipo|Ana/.test(document.querySelector('.ig-top').innerText)), 'sketch: HUD shows the sketch counter (not the previous mode’s chips)');
  for (let k = 0; k < 5; k++) { await sim(.4); await g(() => window.__GAME.autoDraw(6 + Math.floor(Math.random() * 5))); if (k === 1) await shot('sketch'); if (k === 3) { console.log('sketch timeout', JSON.stringify(await sim(21))); } else { await g(() => window.__GAME.done()); } await sim(2.6); if (k === 2) await shot('gallery'); }
  await sim(1); await p.waitForTimeout(500); await shot('sketch_results');
  check(await g(() => window.__GAME.gallery()) === 5, 'sketch: 5 sketches on the gallery wall');
  await g(() => window.__GAME.done()); await sim(3);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'sketch: E.results exactly once');

  // ---- telephone: 4 players in Spanish
  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'phone', players: 4, lang: 'es' }));
  await sim(.3); await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(7)); await shot('phone_draw'); await g(() => window.__GAME.done()); await sim(.8);
  await g(() => window.__GAME.next()); await sim(.5); await shot('phone_describe'); await g(() => window.__GAME.describe('un gato con sombrero')); await sim(.5);
  await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(6)); await g(() => window.__GAME.done()); await sim(.8);
  await g(() => window.__GAME.next()); await sim(.5); await g(() => window.__GAME.describe('¿un pulpo bailando?')); await sim(.6);
  console.log('show', JSON.stringify(await sim(1))); await shot('phone_slide1');
  await sim(4.3); await shot('phone_slide2');
  console.log('slides', JSON.stringify(await sim(20))); await p.waitForTimeout(600); await shot('phone_results');
  await g(() => { window.__GAME.advanceSlide(); window.__GAME.advanceSlide(); }); await sim(5);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'telephone: E.results exactly once');
  const esRes = await g(() => document.querySelector('.ig-results').innerText);
  check(/Inicio/.test(esRes) && !/Play again|ROUND OVER|NEW BEST|Hero lv|\bHub\b|\bBest\b|Settings|Share/.test(esRes), 'telephone (ES): results card fully Spanish');

  // ---- daily doodle: same prompt all day, streak, same-day replace, gallery viewer, share card
  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'daily', lang: 'en' }));
  await sim(.5); const dw = await g(() => [window.__GAME.G.word.en, window.__GAME.dailyWord().en, window.__GAME.dailyWord('2026-01-01').en, window.__GAME.dailyWord('2026-01-02').en]);
  check(dw[0] === dw[1] && dw[2] !== dw[3], `daily: one prompt per day (${dw[0]}; Jan 1 ${dw[2]}, Jan 2 ${dw[3]})`);
  await g(() => window.__GAME.demoPicture()); await sim(.2); await shot('daily');
  await g(() => window.__GAME.done()); await sim(2); await p.waitForTimeout(300); await shot('daily_results');
  check(await plays() === pl0 + 1 && await nResults() === 1, 'daily: E.results exactly once');
  check(await g(() => window.__GAME.dailyList().length === 1 && window.__GAME.dailyStreak() === 1), 'daily: saved to the daily gallery, streak 1');
  await clean(); await g(() => { const d = new Date(); d.setDate(d.getDate() - 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const l = JSON.parse(localStorage.getItem('inoa.draw.daily')); l.push({ day: k, en: 'cat', es: 'gato', img: l[0].img, t: 1 }); localStorage.setItem('inoa.draw.daily', JSON.stringify(l)); window.__GAME.start({ mode: 'daily', lang: 'en' }); });
  await sim(.4); await g(() => window.__GAME.autoDraw(3)); await g(() => window.__GAME.done()); await sim(2);
  check(await g(() => window.__GAME.dailyList().length === 2 && window.__GAME.dailyStreak() === 2), 'daily: drawing again today replaces today’s doodle; yesterday + today = streak 2');
  await clean(); await g(() => { window.__GAME.title(); window.__GAME.openGallery('daily'); }); await sim(.4); await shot('gallery_view');
  check(await g(() => document.querySelectorAll('.dw-gal [data-i]').length === 2), 'gallery viewer: lists the daily doodles');
  await g(() => document.querySelector('.dw-gal [data-i="1"]').click()); await sim(.2); await shot('gallery_item');
  const cardImg = await g(async () => { const m = await window.__GAME.makeCard('daily', 1); return { w: m.canvas.width, h: m.canvas.height, url: m.canvas.toDataURL('image/png'), name: m.name }; });
  require('fs').writeFileSync(__dirname + '/out/draw_sharecard' + SUF + '.png', Buffer.from(cardImg.url.split(',')[1], 'base64'));
  check(cardImg.w === 1080 && cardImg.h === 1350 && /^draw-the-pact-/.test(cardImg.name), `share card: 1080x1350 PNG (${cardImg.name})`);
  const shared = await g(async () => { let got = null; Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); Object.defineProperty(navigator, 'share', { value: async (d) => { got = d.files && d.files[0] && d.files[0].type; }, configurable: true }); const r = await window.__GAME.shareCard('daily', 0); return r + ':' + got; });
  check(shared === 'shared:image/png', `share card: handed to the system share sheet as a PNG file (${shared})`);
  await g(() => { delete navigator.share; delete navigator.canShare; });
  await g(() => document.querySelector('.dw-galcard [data-a=del]').click()); await sim(.2);
  check(await g(() => window.__GAME.dailyList().length === 1), 'gallery viewer: remove deletes one doodle');
  await g(() => document.querySelector('.dw-galcard [data-a=back]').click()); await sim(.2);

  // ---- guess the doodle: keyboard digits, wrong then right, timeouts
  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'doodle', lang: 'en' }));
  await sim(2); await shot('doodle');
  check(await g(() => window.__GAME.choices().length === 4 && window.__GAME.D.strokes.length > 0 && !window.__GAME.D.enabled), 'doodle: the pencil draws by itself and 4 answers are offered');
  const pickKey = async (right) => { const i = await g((right) => { const G = window.__GAME.G; const k = G.opts.indexOf(G.word); return right ? k : (k + 1) % 4; }, right); await p.keyboard.press(String(i + 1)); };
  await pickKey(true); await sim(.2); await shot('doodle_right');
  check(await g(() => window.__GAME.G.score === 3 && window.__GAME.G.phase === 'shown'), 'doodle: key 1-4 picks; an early right answer scores 3');
  await sim(2);
  await pickKey(false); await sim(.1); check(await g(() => window.__GAME.G.phase === 'guess' && document.querySelectorAll('#dwTools .no').length === 1), 'doodle: a wrong answer is crossed out and you can try again'); await pickKey(true); await sim(2);
  check(await g(() => window.__GAME.G.score === 4), 'doodle: right after a wrong try scores 1');
  await sim(13); check(await g(() => window.__GAME.G.k === 3 || window.__GAME.G.phase === 'shown'), 'doodle: no answer → the doodle times out and moves on');
  await sim(3);
  for (let k = 0; k < 5; k++) { await pickKey(true); await sim(2); }
  await sim(1); await p.waitForTimeout(300); await shot('doodle_results');
  check(await plays() === pl0 + 1 && await nResults() === 1, 'doodle: E.results exactly once');
  const dd = await g(() => window.__GAME.G.used.map(w => w.en)); check(new Set(dd).size === 8, 'doodle: 8 different doodles');

  // ================= real pointer checks =================
  const PAPER = [255, 253, 247], RED = [226, 68, 58], BLUE = [47, 95, 208], INK = [27, 36, 48], GREEN = [47, 191, 138], ORANGE = [255, 138, 42], YELLOW = [255, 209, 102];
  const near = (a, b, t = 40) => Math.abs(a[0] - b[0]) < t && Math.abs(a[1] - b[1]) < t && Math.abs(a[2] - b[2]) < t;
  const px = (x, y) => g(([x, y]) => [...document.getElementById('pad').getContext('2d').getImageData(Math.round(x * 1024), Math.round(y * 768), 1, 1).data].slice(0, 3), [x, y]);
  // run of pixels matching colour along a column (vertical) or a row: returns {n, c} (count, centre in canvas px)
  const run = (axis, at, col) => g(([axis, at, col]) => { const ctx = document.getElementById('pad').getContext('2d'); const d = axis === 'col' ? ctx.getImageData(Math.round(at * 1024), 0, 1, 768).data : ctx.getImageData(0, Math.round(at * 768), 1024, 1).data; let n = 0, s = 0; for (let i = 0; i < d.length / 4; i++) { if (Math.abs(d[i * 4] - col[0]) < 40 && Math.abs(d[i * 4 + 1] - col[1]) < 40 && Math.abs(d[i * 4 + 2] - col[2]) < 40) { n++; s += i; } } return { n, c: n ? s / n : -1 }; }, [axis, at, col]);
  // canvas snapshot + compare: undo must restore the same stroke list and the same pixels
  const snap = () => g(() => { window.__snap = { d: document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data.slice(), s: JSON.stringify(window.__GAME.D.strokes) }; });
  const same = () => g(() => { const d = document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data, o = window.__snap.d; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(Math.abs(d[i] - o[i]), Math.abs(d[i + 1] - o[i + 1]), Math.abs(d[i + 2] - o[i + 2])) > 48) n++; window.__lastDiff = n; return JSON.stringify(window.__GAME.D.strokes) === window.__snap.s && n < 400; });
  const hash = () => g(() => { const d = document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (Math.imul(h, 31) + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; return h; });
  const rect = () => g(() => { const r = document.getElementById('pad').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const mstroke = async (pts) => { const r = await rect(); const at = q => [r.x + q[0] * r.w, r.y + q[1] * r.h]; await p.mouse.move(...at(pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...at(q), { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(50); };
  const pick = async (sel) => { await p.click(sel, { timeout: 15000 }); await p.waitForTimeout(50); };
  const nStrokes = () => g(() => window.__GAME.D.strokes.length);
  const pen = (pts, pressure, opt = {}) => g(([pts, pressure, opt]) => { const c = document.getElementById('pad'), r = c.getBoundingClientRect(); const ev = (type, q) => c.dispatchEvent(new PointerEvent(type, { pointerId: opt.id || 7, pointerType: opt.type || 'pen', pressure, isPrimary: true, clientX: r.left + q[0] * r.width, clientY: r.top + q[1] * r.height, width: opt.w || 1, height: opt.w || 1, bubbles: true, cancelable: true, button: 0, buttons: 1 })); ev('pointerdown', pts[0]); for (const q of pts.slice(1)) ev('pointermove', q); if (!opt.noEnd) ev(opt.cancel ? 'pointercancel' : 'pointerup', pts[pts.length - 1]); }, [pts, pressure, opt]);
  const hline = (y, x0 = .05, x1 = .25) => [[x0, y], [(x0 + x1) / 2, y], [x1, y]];

  pl0 = await plays();
  await clean(); await g(() => window.__GAME.start({ mode: 'sketch', sketchSec: 900, lang: 'en' }));
  await sim(.5); await p.waitForTimeout(300);
  // colour + size via real clicks, then a real mouse stroke
  await pick('#dwTools .dw-pal button[data-c="#e2443a"]'); await pick('#dwTools .dw-size button[data-s="2"]');
  await mstroke([[.3, .4], [.45, .4], [.6, .4]]);
  let rr = await run('col', .45, RED);
  check(Math.abs(rr.c - .4 * 768) < 4, `mouse stroke lands at the right y (centre ${rr.c.toFixed(1)} vs ${(.4 * 768).toFixed(1)})`);
  check(Math.abs(rr.n - .028 * 1024) < 6, `size 3 thickness ≈ 29px (got ${rr.n})`);
  check(near(await px(.45, .5), PAPER), 'no ink outside the stroke');
  await snap(); const s1 = await nStrokes();
  await pick('#dwTools .dw-pal button[data-c="#2f5fd0"]'); await pick('#dwTools .dw-size button[data-s="0"]');
  await mstroke([[.7, .2], [.7, .5], [.7, .8]]);
  rr = await run('row', .5, BLUE);
  check(Math.abs(rr.c - .7 * 1024) < 4, `mouse stroke lands at the right x (centre ${rr.c.toFixed(1)} vs ${(.7 * 1024).toFixed(1)})`);
  check(Math.abs(rr.n - .006 * 1024) <= 3, `size 1 thickness ≈ 6px (got ${rr.n})`);
  await p.keyboard.press('z'); check(await same() && await nStrokes() === s1, 'Z undo restores the previous strokes + canvas'); console.log('  pixels off after undo:', await g(() => window.__lastDiff));
  await p.keyboard.press('y'); rr = await run('row', .5, BLUE); check(Math.abs(rr.c - .7 * 1024) < 4 && await nStrokes() === s1 + 1, 'Y redo brings the stroke back');
  await pick('#dwTools [data-t=undo]'); check(await same(), 'undo button restores the previous canvas');
  await pick('#dwTools [data-t=redo]'); await p.keyboard.press('Control+z'); check(await same(), 'redo button + Ctrl+Z round trip');
  await mstroke([[.7, .2], [.7, .8]]); check(await g(() => window.__GAME.D.redo.length === 0 && document.querySelector('#dwTools [data-t=redo]').disabled), 'a new stroke empties redo (button disabled)');
  await p.keyboard.press('Control+z'); check(await same(), 'Ctrl+Z restores the previous canvas');
  await pick('#dwTools [data-t=clear]'); check(near(await px(.45, .4), PAPER), 'clear wipes the page');
  await p.keyboard.press('z'); check(await same(), 'undo after clear brings the drawing back');
  // eraser (keyboard toggle) over the red line
  await p.keyboard.press('e'); await p.keyboard.press('3'); check(await g(() => window.__GAME.D.eraser && window.__GAME.D.size === 2), 'E toggles eraser, 3 picks the big brush');
  await mstroke([[.45, .3], [.45, .4], [.45, .5]]);
  check(near(await px(.45, .4), PAPER) && near(await px(.35, .4), RED), 'eraser erases only where it passes');
  await p.keyboard.press('e'); await p.keyboard.press('[');
  check(await g(() => !window.__GAME.D.eraser && window.__GAME.D.color === '#4fb3ff'), 'E toggles eraser off, [ cycles to the previous colour');
  await pick('#dwTools .dw-pal button[data-c="#1b2430"]');
  // stylus pressure (synthetic PointerEvents, pointerType pen) vs mouse / touch at size 2
  await p.keyboard.press('2');
  await pen(hline(.12), 1.0); await pen(hline(.2), .2); await pen(hline(.28), 0); await mstroke(hline(.36)); await p.waitForTimeout(1600); await pen(hline(.44), .5, { type: 'touch', id: 9 }); await pen(hline(.52), 0, { type: 'touch', id: 10 });
  const thick = (y) => g(([y]) => { const d = document.getElementById('pad').getContext('2d').getImageData(Math.round(.15 * 1024), 0, 1, 768).data; let n = 0; for (let i = Math.round((y - .05) * 768); i < Math.round((y + .05) * 768); i++) if (Math.abs(d[i * 4] - 27) < 40 && Math.abs(d[i * 4 + 1] - 36) < 40 && Math.abs(d[i * 4 + 2] - 48) < 40) n++; return n; }, [y]);
  const w = []; for (const y of [.12, .2, .28, .36, .44, .52]) w.push(await thick(y));
  console.log('widths pen1 / pen.2 / pen0 / mouse / touch.5 / touch0:', w.join(' / '));
  check(w[0] > w[3] && w[3] > w[1] && w[1] > 0, 'pen pressure scales width (1.0 > mouse > 0.2)');
  check(Math.abs(w[2] - w[3]) <= 3 && Math.abs(w[4] - w[3]) <= 1 && Math.abs(w[5] - w[3]) <= 1, 'pressure 0 / touch / mouse degrade to the normal width');
  check(await g(() => { const s = window.__GAME.D.strokes.filter(s => !s.clear && !s.t); return s.slice(-6).map(x => x.pen ? 1 : 0).join(''); }) === '111000', 'only pen strokes are pressure-sensitive');
  // palm rejection: a touch right after the pen, or a huge contact patch, draws nothing; a palm line is dropped when the pen lands
  let sc0 = await nStrokes(); await pen(hline(.6), .6, { id: 20 }); await pen(hline(.66, .3, .5), .5, { type: 'touch', id: 21 });
  check(await nStrokes() === sc0 + 1, 'palm rejection: a touch within 1.5 s of the pen is ignored');
  await p.waitForTimeout(1600); sc0 = await nStrokes(); await pen(hline(.66, .3, .5), .5, { type: 'touch', id: 22, w: 70 });
  check(await nStrokes() === sc0, 'palm rejection: a 70×70 px contact patch is ignored');
  await pen(hline(.7, .3, .5), .5, { type: 'touch', id: 23, noEnd: true }); await pen(hline(.74, .3, .5), .7, { id: 24 });
  check(await nStrokes() === sc0 + 1 && await g(() => window.__GAME.D.strokes[window.__GAME.D.strokes.length - 1].pen === true), 'palm rejection: a palm line that started just before the pen is dropped');
  await g(() => { const c = document.getElementById('pad'); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 23, pointerType: 'touch', bubbles: true })); });
  // two-finger tap = undo (wait out the pen's palm window first)
  await p.waitForTimeout(1600); sc0 = await nStrokes();
  await g(() => { const c = document.getElementById('pad'), r = c.getBoundingClientRect(); const ev = (type, id, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 31, clientX: r.left + x * r.width, clientY: r.top + .5 * r.height, width: 10, height: 10, bubbles: true, cancelable: true, buttons: 1 })); ev('pointerdown', 31, .4); ev('pointerdown', 32, .6); ev('pointerup', 31, .4); ev('pointerup', 32, .6); });
  check(await nStrokes() === sc0 - 1 && await g(() => window.__GAME.D.redo.length === 1), 'two-finger tap = undo (and draws no dot)');
  await p.keyboard.press('y');
  // pointercancel ends a stroke cleanly; later moves with that id do nothing
  sc0 = await nStrokes(); await pen(hline(.62), .6, { id: 11, cancel: true });
  const hc = await hash();
  await g(() => { const c = document.getElementById('pad'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, pointerType: 'pen', pressure: .6, clientX: r.left + .9 * r.width, clientY: r.top + .9 * r.height, bubbles: true })); });
  check(await nStrokes() === sc0 + 1 && await g(() => window.__GAME.D.cur === null) && await hash() === hc, 'pointercancel ends the stroke; stray moves are ignored');
  await pen([[.05, .7], [.15, .7]], .6, { id: 12, noEnd: true }); await mstroke(hline(.78));
  check(await g(() => window.__GAME.D.cur === null) && await nStrokes() === sc0 + 3, 'a new pointer finishes a dangling stroke before starting its own');
  await shot('pointer_tools');
  // tools: shapes (rectangle by drag), fill bucket inside it, undo/redo of a fill, sticker tap, a shape tap draws nothing
  await pick('#dwTools [data-t=clear]'); await pick('#dwTools .dw-pal button[data-c="#1b2430"]'); await pick('#dwTools .dw-size button[data-s="1"]');
  await pick('#dwTools [data-tool=shape]'); await pick('#dwTools [data-tool=shape]'); check(await g(() => window.__GAME.D.tool === 'shape' && window.__GAME.D.shape === 'rect'), 'shape tool: tapping it again cycles line → rectangle');
  await mstroke([[.3, .3], [.5, .5], [.7, .7]]);
  check(near(await px(.3, .5), INK) && near(await px(.7, .5), INK) && near(await px(.5, .5), PAPER), 'rectangle: drawn from drag start to end, hollow');
  await p.keyboard.press('f'); await pick('#dwTools .dw-pal button[data-c="#ff8a2a"]'); await snap(); await mstroke([[.5, .5], [.5, .5]]);
  check(near(await px(.5, .5), ORANGE, 12) && near(await px(.4, .62), ORANGE, 12) && near(await px(.2, .2), PAPER) && near(await px(.3, .5), INK), 'fill bucket fills inside the shape only, outline kept');
  const halo = await g(() => { const d = document.getElementById('pad').getContext('2d').getImageData(Math.round(.3 * 1024) + 4, Math.round(.5 * 768), 30, 1).data; let pale = 0; for (let i = 0; i < 30; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; if (r > 240 && gg > 240 && b > 230) pale++; } return pale; });
  check(halo === 0, `fill leaves no pale halo along the outline (${halo} px)`);
  await p.keyboard.press('z'); check(await same(), 'undo removes the fill exactly'); await p.keyboard.press('y'); check(near(await px(.5, .5), ORANGE, 12), 'redo repaints the fill');
  await p.keyboard.press('t'); await pick('#dwTools .dw-pal button[data-c="#ffd166"]'); await mstroke([[.15, .2], [.15, .2]]);
  check(near(await px(.15, .2), YELLOW, 12) && await g(() => window.__GAME.D.strokes[window.__GAME.D.strokes.length - 1].k === 'star'), 'sticker: a tap stamps a star in the chosen colour');
  await pick('#dwTools [data-tool=sticker]'); check(await g(() => window.__GAME.D.sticker === 1), 'sticker tool: tapping it again picks the next sticker');
  sc0 = await nStrokes(); await p.keyboard.press('s'); await mstroke([[.85, .85], [.85, .85]]); check(await nStrokes() === sc0, 'a tap with a shape tool adds nothing');
  await p.keyboard.press('d'); check(await g(() => window.__GAME.D.tool === 'pen'), 'D picks the pencil again');
  await shot('tools');
  // resize + rotate: strokes still land where the pointer is
  const other = SUF ? { width: 844, height: 390 } : { width: 390, height: 844 };
  for (const [i, sz] of [[0, { width: Math.round(vp0.width * .8), height: Math.round(vp0.height * .9) }], [1, other]]) {
    await p.setViewportSize(sz); await p.waitForTimeout(400); await sim(.2);
    await pick('#dwTools .dw-pal button[data-c="#2fbf8a"]');
    const y = .86 + i * .06, x0 = i ? .78 : .5; await mstroke([[x0, y], [x0 + .09, y], [x0 + .18, y]]);
    const r2 = await run('col', x0 + .09, GREEN);
    check(Math.abs(r2.c - y * 768) < 5, `after resize to ${sz.width}x${sz.height}: stroke at y ${r2.c.toFixed(1)} vs ${(y * 768).toFixed(1)}`);
    const pr = await rect(); check(Math.abs(pr.w / pr.h - 4 / 3) < .03 && pr.x >= 0 && pr.x + pr.w <= sz.width + 1, `paper keeps 4:3 and fits (${pr.w.toFixed(0)}x${pr.h.toFixed(0)})`);
    const tl = await g(() => { const r = document.getElementById('dwTools').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1; }); check(tl, `tools panel fits on screen at ${sz.width}x${sz.height}`);
    if (i === 1) await shot('rotated_draw');
  }
  await p.setViewportSize(vp0); await p.waitForTimeout(400); await sim(.2);
  for (let k = 0; k < 5; k++) { await g(() => window.__GAME.done()); await sim(2.6); await g(() => window.__GAME.autoDraw(3)); }
  await sim(1); await g(() => window.__GAME.done());
  check(await plays() === pl0 + 1 && await nResults() === 1, 'pointer sketch session: E.results exactly once');

  // ================= gamepad + keyboard, in Spanish =================
  await g(() => { const mk = () => ({ pressed: false, value: 0 }); window.__pad = { id: 'test-pad', index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, mk) }; Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad], configurable: true }); });
  const btn = async (i, on) => g(([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
  const press = async (i) => { await btn(i, true); await sim(.1); await btn(i, false); await sim(.1); };
  const axes = (x, y) => g(([x, y]) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; }, [x, y]);
  const focusA = () => g(() => { const f = document.querySelector('.gp-focus'); return f ? (f.dataset.a || f.tagName + ':' + f.textContent.trim()) : null; });
  const ENGLISH = /Settings|\bBest\b|NEW BEST|Share\b|\bPlay\b|\bHub\b|Paused|Resume|ROUND OVER|Hero lv|Pass the|Next ▶|Done ✓|Show my word|Start drawing|Speed Sketch|\bUndo\b|What is the pencil|Team |Gallery|Daily doodle|Guess the doodle/;
  const texts = [];
  const grab = async (label) => { const t = await g(() => [...document.querySelectorAll('.ig-screen, .dw-slide, #dw:not([hidden]) .dw-prompt, #dw:not([hidden]) .dw-act')].map(e => e.innerText).join(' | ')); texts.push([label, t]); };
  pl0 = await plays();
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); Object.assign(window.__GAME.S, { mode: 'party', players: 2, rounds: 1, lang: 'es', diff: 1 }); window.__GAME.title(); });
  await sim(.4); await grab('title'); await shot('es_title');
  await press(13); check(await focusA() === 'play', 'gamepad: D-pad focuses the Play button first');
  await press(14); const left = await focusA(); check(left && left !== 'play', `gamepad: D-pad left moves focus (${left})`);
  await press(15); check(await focusA() === 'play', 'gamepad: D-pad right comes back to Play');
  await press(0); await sim(.4); check(await g(() => window.__GAME.G && window.__GAME.G.mode === 'party' && !document.querySelector('.ig-title')), 'gamepad: A starts the party');
  await grab('pass'); await press(0); await sim(.3); await grab('peek'); await press(0); await sim(.4);
  check(await g(() => window.__GAME.D.enabled && window.__GAME.G.phase === 'draw'), 'gamepad: A → show word → start drawing');
  await grab('draw');
  const st0 = await nStrokes();
  await axes(1, 0); await sim(.3); await axes(0, 0); await sim(.05);
  check(await g(() => window.__GAME.NAV.cur.x > .55 && getComputedStyle(document.querySelector('.dw-cursor')).display === 'block'), 'gamepad: stick moves the drawing cursor');
  await btn(0, true); await sim(.05); await axes(-.3, 1); await sim(.4); await axes(0, 0); await btn(0, false); await sim(.1);
  check(await nStrokes() === st0 + 1 && await g(() => window.__GAME.D.strokes[window.__GAME.D.strokes.length - 1].p.length > 4), 'gamepad: hold A + stick draws a stroke');
  const c0 = await g(() => window.__GAME.D.color); await press(5); check(await g(() => window.__GAME.D.color) !== c0, 'gamepad: RB changes colour');
  const z0 = await g(() => window.__GAME.D.size); await press(z0 === 2 ? 6 : 7); check(await g(() => window.__GAME.D.size) !== z0, 'gamepad: RT / LT change size');
  await press(2); check(await g(() => window.__GAME.D.eraser), 'gamepad: X toggles eraser'); await press(2);
  await press(1); check(await nStrokes() === st0, 'gamepad: B undoes');
  await press(11); check(await g(() => window.__GAME.D.tool === 'fill'), 'gamepad: R3 cycles the tool (pencil → fill)'); await press(11); await press(11); await press(11);
  check(await g(() => window.__GAME.D.tool === 'pen'), 'gamepad: R3 cycles back to the pencil');
  await btn(3, true); await sim(.1); check(await g(() => !!document.querySelector('#dwPrompt b')), 'gamepad: hold Y peeks at the word'); await btn(3, false); await sim(.1);
  check(await g(() => !document.querySelector('#dwPrompt b')), 'gamepad: release Y hides the word');
  await btn(0, true); await sim(.05); await axes(.8, -.6); await sim(.5); await axes(0, 0); await btn(0, false); await sim(.2); await shot('gp_draw');
  await press(8); await sim(.2); check(await g(() => window.__GAME.G.phase === 'who'), 'gamepad: Select = "someone guessed"');
  await grab('who'); await press(0); await sim(1.6); await grab('reveal');
  check(await g(() => window.__GAME.G.phase === 'reveal' && !!document.querySelector('[data-a=next]')), 'gamepad: A picks the guesser → reveal');
  await press(0); await sim(.3);
  // turn 2 with the keyboard only
  await p.keyboard.press('Enter'); await sim(.2); await p.keyboard.press('Enter'); await sim(.4);
  check(await g(() => window.__GAME.D.enabled), 'keyboard: Enter → show word → start drawing');
  await g(() => window.__GAME.autoDraw(3));
  await p.keyboard.press(']'); await p.keyboard.down('q'); await sim(.05); check(await g(() => !!document.querySelector('#dwPrompt b')), 'keyboard: hold Q peeks'); await p.keyboard.up('q');
  await p.keyboard.press('Enter'); await sim(.2); check(await g(() => window.__GAME.G.phase === 'who'), 'keyboard: Enter = "someone guessed"');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await sim(1.6);
  check(await g(() => window.__GAME.G.phase === 'reveal'), 'keyboard: arrows + Enter pick the guesser');
  await p.keyboard.press('Enter'); await sim(1); await p.waitForTimeout(400);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'gamepad/keyboard party: E.results exactly once');
  await grab('results'); await shot('es_results');
  await press(0); await sim(.4); check(await g(() => !!document.querySelector('.ig-title') && !document.querySelector('.ig-results')), 'gamepad: A on results = play again → title');
  // guess the doodle with the gamepad, in Spanish
  pl0 = await plays();
  await g(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'doodle', lang: 'es' }); }); await sim(1.5); await grab('doodle'); await shot('es_doodle');
  for (let k = 0; k < 8; k++) {
    const want = await g(() => { const G = window.__GAME.G; return G.opts.indexOf(G.word); });
    await press(12); // first D-pad press focuses the first answer
    for (let n = 0; n < 6 && await g((want) => { const f = document.querySelector('#dwTools .gp-focus'); return !f || +f.dataset.o !== want; }, want); n++) { const at = await g(() => { const f = document.querySelector('#dwTools .gp-focus'); return f ? +f.dataset.o : 0; }); const portrait = await g(() => innerHeight > innerWidth); await press(portrait ? (want % 2 > at % 2 ? 15 : want % 2 < at % 2 ? 14 : want > at ? 13 : 12) : (want > at ? 13 : 12)); }
    await press(0); await sim(2.2);
  }
  await sim(1); await p.waitForTimeout(300);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'gamepad doodle: D-pad + A answer all 8, E.results exactly once');
  check(await g(() => /8\/8/.test(document.querySelector('.ig-results').innerText)), 'gamepad doodle: 8/8 right answers');
  await grab('doodle_results');
  // gallery viewer in Spanish
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.title(); window.__GAME.openGallery('sketch'); }); await sim(.3); await grab('gallery');
  await g(() => document.querySelector('.dw-galcard [data-a=back]').click());
  // team mode pass card + pause menu via Start, in Spanish
  await g(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'team', players: 4, lang: 'es' }); }); await sim(.3); await grab('team');
  await g(() => { window.__GAME.title(); document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'sketch', sketchSec: 60, lang: 'es' }); }); await sim(.4);
  await grab('sketch'); await press(9); await sim(.1); await grab('pause'); await shot('es_pause');
  check(await g(() => window.__GAME.G.paused && /pausa/i.test(document.querySelector('.ig-screen').innerText)), 'gamepad: Start pauses (menu in Spanish)');
  await press(9); await sim(.1); check(await g(() => !window.__GAME.G.paused), 'gamepad: Start resumes');
  for (const [label, t] of texts) { const m = t.match(ENGLISH); check(!m, `ES ${label}: no English UI text${m ? ' (found "' + m[0] + '")' : ''}`); }
  await g(() => { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); window.__GAME.title(); }); await sim(.3);
  if (process.env.DRAW_THUMB) { await g(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'sketch', sketchSec: 60, lang: 'en' }); }); await sim(.4); await g(() => { window.__GAME.demoPicture(); window.__GAME.camView('draw'); }); await sim(2); await shot('thumb_src'); }
  console.log(fails.length ? `DRAW_CHECKS_FAILED ${fails.length}: ${fails.join('; ')}` : 'DRAW_CHECKS_PASSED');
  if (fails.length) console.error('draw checks failed: ' + fails.join('; '));
};
