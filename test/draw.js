// Draw the Pact headless test: title → party round (pass, peek, auto-draw, someone guessed, reveal) →
// speed sketch saved to the gallery wall → telephone chain (draw → describe → draw) slideshow →
// real pointer checks (mouse + synthetic pen with pressure, undo, eraser, sizes, colours, pointercancel, resize/rotate) →
// gamepad + keyboard play-through in Spanish (language consistency of engine cards) → results-exactly-once checks.
// Screenshots: test/out/draw_<name>.png in landscape, draw_<name>_p.png when the run is portrait (W<H).
module.exports = async (p) => {
  const vp0 = p.viewportSize(); const SUF = vp0.height > vp0.width ? '_p' : '';
  const fails = []; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/draw_' + n + SUF + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  const sim = (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } return g.G ? { phase: g.G.phase, t: g.G.timer && +g.G.timer.left.toFixed(1) } : null; }, sec);
  const g = (fn, arg) => p.evaluate(fn, arg);
  const plays = () => g(() => (JSON.parse(localStorage.getItem('inoa.profile') || '{}').games || {}).draw?.plays || 0);
  const nResults = () => g(() => document.querySelectorAll('.ig-results').length);
  await shot('title');
  // ---- party: 3 players, 1 round
  let pl0 = await plays();
  await g(() => { localStorage.removeItem('inoa.draw.gallery'); document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'party', players: 3, rounds: 1, lang: 'en', diff: 1 }); });
  await sim(.5); await shot('pass');
  await g(() => window.__GAME.next()); await sim(.3); await shot('peek');
  await g(() => window.__GAME.next()); await sim(.5);
  await g(() => window.__GAME.autoDraw(9)); await sim(5); await shot('drawing');
  console.log('strokes', await g(() => window.__GAME.D.strokes.length));
  await g(() => window.__GAME.undo()); await g(() => window.__GAME.autoDraw(1));
  await g(() => window.__GAME.guessed(1)); console.log('reveal', JSON.stringify(await sim(2))); await shot('reveal');
  // remaining two turns: let the timer run out on one, guess on the other
  for (let t = 0; t < 2; t++) { await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.2); await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(5)); if (t === 0) console.log('timeout', JSON.stringify(await sim(62))); else { await g(() => window.__GAME.guessed(0)); await sim(1.5); } }
  await g(() => window.__GAME.next()); await sim(1); await p.waitForTimeout(600); await shot('party_results');
  console.log('party results', await g(() => !!document.querySelector('.ig-results')));
  await g(() => { window.__GAME.next(); window.__GAME.next(); }); await sim(.5);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'party: E.results exactly once');
  // ---- speed sketch: 5 prompts
  pl0 = await plays();
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.start({ mode: 'sketch', sketchSec: 20 }); });
  for (let k = 0; k < 5; k++) { await sim(.4); await g(() => window.__GAME.autoDraw(6 + Math.floor(Math.random() * 5))); if (k === 1) await shot('sketch'); if (k === 3) { console.log('sketch timeout', JSON.stringify(await sim(21))); } else { await g(() => window.__GAME.done()); } await sim(2.6); if (k === 2) await shot('gallery'); }
  await sim(1); await p.waitForTimeout(500); await shot('sketch_results');
  console.log('gallery items', await g(() => window.__GAME.gallery()));
  await g(() => window.__GAME.done()); await sim(3);
  check(await plays() === pl0 + 1 && await nResults() === 1, 'sketch: E.results exactly once');
  // ---- telephone: 4 players in Spanish
  pl0 = await plays();
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.start({ mode: 'phone', players: 4, lang: 'es' }); });
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

  // ================= real pointer checks =================
  const PAPER = [255, 253, 247], RED = [226, 68, 58], BLUE = [47, 95, 208], INK = [27, 36, 48], GREEN = [47, 191, 138];
  const near = (a, b, t = 40) => Math.abs(a[0] - b[0]) < t && Math.abs(a[1] - b[1]) < t && Math.abs(a[2] - b[2]) < t;
  const px = (x, y) => g(([x, y]) => [...document.getElementById('pad').getContext('2d').getImageData(Math.round(x * 1024), Math.round(y * 768), 1, 1).data].slice(0, 3), [x, y]);
  // run of pixels matching colour along a column (vertical) or a row: returns {n, c} (count, centre in canvas px)
  const run = (axis, at, col) => g(([axis, at, col]) => { const ctx = document.getElementById('pad').getContext('2d'); const d = axis === 'col' ? ctx.getImageData(Math.round(at * 1024), 0, 1, 768).data : ctx.getImageData(0, Math.round(at * 768), 1024, 1).data; let n = 0, s = 0; for (let i = 0; i < d.length / 4; i++) { if (Math.abs(d[i * 4] - col[0]) < 40 && Math.abs(d[i * 4 + 1] - col[1]) < 40 && Math.abs(d[i * 4 + 2] - col[2]) < 40) { n++; s += i; } } return { n, c: n ? s / n : -1 }; }, [axis, at, col]);
  // canvas snapshot + compare: undo must restore the same stroke list and (within raster AA noise, since Chrome may move a
  // read-back canvas from GPU to CPU raster) the same pixels
  const snap = () => g(() => { window.__snap = { d: document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data.slice(), s: JSON.stringify(window.__GAME.D.strokes) }; });
  const same = () => g(() => { const d = document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data, o = window.__snap.d; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(Math.abs(d[i] - o[i]), Math.abs(d[i + 1] - o[i + 1]), Math.abs(d[i + 2] - o[i + 2])) > 48) n++; window.__lastDiff = n; return JSON.stringify(window.__GAME.D.strokes) === window.__snap.s && n < 400; });
  const hash = () => g(() => { const d = document.getElementById('pad').getContext('2d').getImageData(0, 0, 1024, 768).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (Math.imul(h, 31) + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; return h; });
  const rect = () => g(() => { const r = document.getElementById('pad').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const mstroke = async (pts) => { const r = await rect(); const at = q => [r.x + q[0] * r.w, r.y + q[1] * r.h]; await p.mouse.move(...at(pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...at(q), { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(50); };
  const pick = async (sel) => { await p.click(sel, { timeout: 15000 }); await p.waitForTimeout(50); };
  const nStrokes = () => g(() => window.__GAME.D.strokes.length);
  const pen = (pts, pressure, opt = {}) => g(([pts, pressure, opt]) => { const c = document.getElementById('pad'), r = c.getBoundingClientRect(); const ev = (type, q) => c.dispatchEvent(new PointerEvent(type, { pointerId: opt.id || 7, pointerType: opt.type || 'pen', pressure, isPrimary: true, clientX: r.left + q[0] * r.width, clientY: r.top + q[1] * r.height, bubbles: true, cancelable: true, button: 0, buttons: 1 })); ev('pointerdown', pts[0]); for (const q of pts.slice(1)) ev('pointermove', q); if (!opt.noEnd) ev(opt.cancel ? 'pointercancel' : 'pointerup', pts[pts.length - 1]); }, [pts, pressure, opt]);
  const hline = (y, x0 = .05, x1 = .25) => [[x0, y], [(x0 + x1) / 2, y], [x1, y]];

  pl0 = await plays();
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.start({ mode: 'sketch', sketchSec: 900, lang: 'en' }); });
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
  await mstroke([[.7, .2], [.7, .8]]); await pick('#dwTools [data-t=undo]'); check(await same(), 'undo button restores the previous canvas');
  await mstroke([[.7, .2], [.7, .8]]); await p.keyboard.press('Control+z'); check(await same(), 'Ctrl+Z restores the previous canvas');
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
  await pen(hline(.12), 1.0); await pen(hline(.2), .2); await pen(hline(.28), 0); await mstroke(hline(.36)); await pen(hline(.44), .5, { type: 'touch', id: 9 }); await pen(hline(.52), 0, { type: 'touch', id: 10 });
  const thick = (y) => g(([y]) => { const d = document.getElementById('pad').getContext('2d').getImageData(Math.round(.15 * 1024), 0, 1, 768).data; let n = 0; for (let i = Math.round((y - .05) * 768); i < Math.round((y + .05) * 768); i++) if (Math.abs(d[i * 4] - 27) < 40 && Math.abs(d[i * 4 + 1] - 36) < 40 && Math.abs(d[i * 4 + 2] - 48) < 40) n++; return n; }, [y]);
  const w = []; for (const y of [.12, .2, .28, .36, .44, .52]) w.push(await thick(y));
  console.log('widths pen1 / pen.2 / pen0 / mouse / touch.5 / touch0:', w.join(' / '));
  check(w[0] > w[3] && w[3] > w[1] && w[1] > 0, 'pen pressure scales width (1.0 > mouse > 0.2)');
  check(Math.abs(w[2] - w[3]) <= 3 && Math.abs(w[4] - w[3]) <= 1 && Math.abs(w[5] - w[3]) <= 1, 'pressure 0 / touch / mouse degrade to the normal width');
  check(await g(() => { const s = window.__GAME.D.strokes.filter(s => !s.clear); return s.slice(-6).map(x => x.pen ? 1 : 0).join(''); }) === '111000', 'only pen strokes are pressure-sensitive');
  // pointercancel ends a stroke cleanly; later moves with that id do nothing
  const sc0 = await nStrokes(); await pen(hline(.62), .6, { id: 11, cancel: true });
  const hc = await hash();
  await g(() => { const c = document.getElementById('pad'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, pointerType: 'pen', pressure: .6, clientX: r.left + .9 * r.width, clientY: r.top + .9 * r.height, bubbles: true })); });
  check(await nStrokes() === sc0 + 1 && await g(() => window.__GAME.D.cur === null) && await hash() === hc, 'pointercancel ends the stroke; stray moves are ignored');
  await pen([[.05, .7], [.15, .7]], .6, { id: 12, noEnd: true }); await mstroke(hline(.78));
  check(await g(() => window.__GAME.D.cur === null) && await nStrokes() === sc0 + 3, 'a new pointer finishes a dangling stroke before starting its own');
  await shot('pointer_tools');
  // resize + rotate: strokes still land where the pointer is
  const other = SUF ? { width: 844, height: 390 } : { width: 390, height: 844 };
  for (const [i, sz] of [[0, { width: Math.round(vp0.width * .8), height: Math.round(vp0.height * .9) }], [1, other]]) {
    await p.setViewportSize(sz); await p.waitForTimeout(400); await sim(.2);
    await pick('#dwTools .dw-pal button[data-c="#2fbf8a"]');
    const y = .86 + i * .06, x0 = i ? .78 : .5; await mstroke([[x0, y], [x0 + .09, y], [x0 + .18, y]]);
    const r2 = await run('col', x0 + .09, GREEN);
    check(Math.abs(r2.c - y * 768) < 5, `after resize to ${sz.width}x${sz.height}: stroke at y ${r2.c.toFixed(1)} vs ${(y * 768).toFixed(1)}`);
    const pr = await rect(); check(Math.abs(pr.w / pr.h - 4 / 3) < .03 && pr.x >= 0 && pr.x + pr.w <= sz.width + 1, `paper keeps 4:3 and fits (${pr.w.toFixed(0)}x${pr.h.toFixed(0)})`);
    if (i === 1) await shot('rotated_draw');
  }
  await p.setViewportSize(vp0); await p.waitForTimeout(400); await sim(.2);
  // finish this sketch session normally
  for (let k = 0; k < 5; k++) { await g(() => window.__GAME.done()); await sim(2.6); await g(() => window.__GAME.autoDraw(3)); }
  await sim(1); await g(() => window.__GAME.done());
  check(await plays() === pl0 + 1 && await nResults() === 1, 'pointer sketch session: E.results exactly once');

  // ================= gamepad + keyboard, in Spanish =================
  await g(() => { const mk = () => ({ pressed: false, value: 0 }); window.__pad = { id: 'test-pad', index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, mk) }; Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad], configurable: true }); });
  const btn = async (i, on) => g(([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
  const press = async (i) => { await btn(i, true); await sim(.1); await btn(i, false); await sim(.1); };
  const axes = (x, y) => g(([x, y]) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; }, [x, y]);
  const focusA = () => g(() => { const f = document.querySelector('.gp-focus'); return f ? (f.dataset.a || f.tagName + ':' + f.textContent.trim()) : null; });
  const ENGLISH = /Settings|\bBest\b|NEW BEST|Share\b|\bPlay\b|\bHub\b|Paused|Resume|ROUND OVER|Hero lv|Pass the|Next ▶|Done ✓|Show my word|Start drawing|Speed Sketch|\bUndo\b/;
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
  const z0 = await g(() => window.__GAME.D.size); await press(7); await press(7); check(await g(() => window.__GAME.D.size) !== z0, 'gamepad: RT changes size');
  await press(2); check(await g(() => window.__GAME.D.eraser), 'gamepad: X toggles eraser'); await press(2);
  await press(1); check(await nStrokes() === st0, 'gamepad: B undoes');
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
  // pause menu via Start, in Spanish
  await g(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'sketch', sketchSec: 60, lang: 'es' }); }); await sim(.4);
  await grab('sketch'); await press(9); await sim(.1); await grab('pause'); await shot('es_pause');
  check(await g(() => window.__GAME.G.paused && /pausa/i.test(document.querySelector('.ig-screen').innerText)), 'gamepad: Start pauses (menu in Spanish)');
  await press(9); await sim(.1); check(await g(() => !window.__GAME.G.paused), 'gamepad: Start resumes');
  for (const [label, t] of texts) { const m = t.match(ENGLISH); check(!m, `ES ${label}: no English UI text${m ? ' (found "' + m[0] + '")' : ''}`); }
  await g(() => { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); window.__GAME.title(); }); await sim(.3);
  console.log(fails.length ? `DRAW_CHECKS_FAILED ${fails.length}: ${fails.join('; ')}` : 'DRAW_CHECKS_PASSED');
  if (fails.length) console.error('draw checks failed: ' + fails.join('; '));
};
