// Draw the Pact headless test: title → party round (pass, peek, auto-draw, someone guessed, reveal) →
// speed sketch saved to the gallery wall → telephone chain (draw → describe → draw) slideshow → portrait.
module.exports = async (p) => {
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/draw_' + n + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  const sim = (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } return g.G ? { phase: g.G.phase, t: g.G.timer && +g.G.timer.left.toFixed(1) } : null; }, sec);
  const g = (fn, arg) => p.evaluate(fn, arg);
  await shot('title');
  // ---- party: 3 players, 1 round
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
  // ---- speed sketch: 5 prompts
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.start({ mode: 'sketch', sketchSec: 20 }); });
  for (let k = 0; k < 5; k++) { await sim(.4); await g(() => window.__GAME.autoDraw(6 + Math.floor(Math.random() * 5))); if (k === 1) await shot('sketch'); if (k === 3) { console.log('sketch timeout', JSON.stringify(await sim(21))); } else { await g(() => window.__GAME.done()); } await sim(2.6); if (k === 2) await shot('gallery'); }
  await sim(1); await p.waitForTimeout(500); await shot('sketch_results');
  console.log('gallery items', await g(() => window.__GAME.gallery()));
  // ---- telephone: 4 players in Spanish
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.start({ mode: 'phone', players: 4, lang: 'es' }); });
  await sim(.3); await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(7)); await shot('phone_draw'); await g(() => window.__GAME.done()); await sim(.8);
  await g(() => window.__GAME.next()); await sim(.5); await shot('phone_describe'); await g(() => window.__GAME.describe('un gato con sombrero')); await sim(.5);
  await g(() => window.__GAME.next()); await sim(.3); await g(() => window.__GAME.autoDraw(6)); await g(() => window.__GAME.done()); await sim(.8);
  await g(() => window.__GAME.next()); await sim(.5); await g(() => window.__GAME.describe('¿un pulpo bailando?')); await sim(.6);
  console.log('show', JSON.stringify(await sim(1))); await shot('phone_slide1');
  await sim(4.3); await shot('phone_slide2');
  console.log('slides', JSON.stringify(await sim(20))); await p.waitForTimeout(600); await shot('phone_results');
  // ---- portrait
  await p.setViewportSize({ width: 390, height: 844 });
  await g(() => { document.querySelectorAll('.ig-results').forEach(e => e.remove()); window.__GAME.title(); }); await sim(.5); await shot('p_title');
  await g(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ mode: 'sketch', sketchSec: 30, lang: 'en' }); }); await sim(.5); await g(() => window.__GAME.autoDraw(8)); await sim(1); await shot('p_draw');
  await g(() => window.__GAME.done()); await sim(1.5); await shot('p_gallery');
};
