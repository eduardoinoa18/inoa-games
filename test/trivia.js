// Pact Trivia headless test: title → solo vs 3 bots (buzz, wrong answer, steal) → auto-play to results →
// 4 local players in Spanish kids mode (wager + secret answer cards) → portrait phone.
module.exports = async (p) => {
  // portrait runs (W<H) get a _p suffix so they never overwrite the landscape shots
  const SUF = process.env.SUFFIX ?? (Number(process.env.H || 560) > Number(process.env.W || 1000) ? '_p' : '');
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/trivia_' + n + SUF + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); if (until && g.G && (until.includes(g.G.phase) || (until.includes('card') && (g.G.wagerCard || g.G.fcard)))) break; if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } return g.G ? { phase: g.G.phase, qi: g.G.qi, scores: g.G.players.map(x => x.score) } : null; }, { sec, until });
  await shot('title');
  await p.evaluate(() => { localStorage.removeItem('inoa.trivia.seen'); window.__GAME.S.lang = 'en'; document.querySelector('.ig-title [data-a=play]').click(); });
  console.log('intro', JSON.stringify(await sim(6, ['buzz'])));
  await shot('question');
  await p.evaluate(() => window.__GAME.buzz(0)); await sim(1.2);
  await shot('answer');
  // answer wrong on purpose → steal phase
  await p.evaluate(() => { const G = window.__GAME.G; window.__GAME.answer((G.cur.correct + 1) % 4); });
  await sim(.4); await shot('wrong');
  console.log('after wrong', JSON.stringify(await sim(2.5, ['steal'])));
  console.log('steal', JSON.stringify(await sim(4, ['answer', 'result'])));
  await shot('steal');
  // let the whole game play out automatically
  await p.evaluate(() => window.__GAME.setAuto(true));
  console.log('to final', JSON.stringify(await sim(200, ['fread', 'freveal'])));
  await shot('final');
  console.log('end', JSON.stringify(await sim(60, ['end'])));
  await sim(1.5); await shot('winner');
  await sim(4); await p.waitForTimeout(500); await shot('results');
  console.log('results', await p.evaluate(() => !!document.querySelector('.ig-results')), 'count', await p.evaluate(() => window.__GAME.resultsCount), 'plays', await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile')).games.trivia.plays));
  // 4 local players, Spanish, kids mode
  await p.evaluate(() => { document.querySelector('.ig-results [data-a=again]').click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.setAuto(false); window.__GAME.start({ humans: 4, lang: 'es', kids: true, bots: false }); });
  console.log('es q', JSON.stringify(await sim(6, ['buzz'])));
  await shot('es_buzz');
  console.log('lang sync', JSON.stringify(await p.evaluate(() => { const g = window.__GAME, G = g.G; const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); return { profile: pr.lang, docLang: document.documentElement.lang, qIsEs: G.cur.q === g.Q[G.cur.id][4] }; })));
  // keyboard: P2 buzzes with L, answers wrong with a digit key
  await p.keyboard.press('KeyL'); await sim(.1);
  console.log('kbd buzz P2', await p.evaluate(() => window.__GAME.G.buzzer));
  await p.keyboard.press('Digit' + (await p.evaluate(() => (window.__GAME.G.cur.correct + 1) % 4 + 1))); 
  console.log('kbd wrong ->', JSON.stringify(await sim(4, ['steal'])));
  // touch: P3 steals by tapping its buzzer, then taps a wrong choice
  await p.evaluate(() => document.querySelector('.tv-buz[data-c="2"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sim(.1);
  console.log('touch buzz P3', await p.evaluate(() => window.__GAME.G.buzzer));
  await p.evaluate(() => { const G = window.__GAME.G; const k = [0, 1, 2, 3].find(k => k !== G.cur.correct && !G.out.includes(k)); document.querySelector('.tv-ch[data-k="' + k + '"]').click(); });
  console.log('touch wrong ->', JSON.stringify(await sim(4, ['steal'])));
  // gamepad: pad 4 presses A to steal
  await p.evaluate(() => { const mk = on => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: on && i === 0 })) }); window.__padOn = true; navigator.getGamepads = () => [mk(false), mk(false), mk(false), mk(window.__padOn)]; });
  await sim(.1); await p.evaluate(() => { window.__padOn = false; });
  console.log('pad buzz P4', await p.evaluate(() => window.__GAME.G.buzzer), await p.evaluate(() => window.__GAME.G.phase));
  // mid-game language switch follows the shared setting, then back
  console.log('switch en', JSON.stringify(await p.evaluate(() => { const g = window.__GAME; g.setLang('en'); const G = g.G; return { qIsEn: G.cur.q === g.Q[G.cur.id][2], btn: document.querySelector('.tv-ch')?.textContent.slice(0, 30), buz: document.querySelector('.tv-buz')?.textContent }; })));
  await p.evaluate(() => window.__GAME.setLang('es')); await sim(.1);
  await shot('es_answer');
  await p.evaluate(() => window.__GAME.answer(window.__GAME.G.cur.correct)); await sim(.8);
  await shot('es_correct');
  await p.evaluate(() => { window.__GAME.setAuto(true); });
  console.log('es final', JSON.stringify(await sim(200, ['finalIntro'])));
  await p.evaluate(() => { window.__GAME.setAuto(false); });
  console.log('wager', JSON.stringify(await sim(8, ['card'])));
  await shot('es_wager');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); // P1 wagers 75% with the keyboard
  console.log('kbd wager', await p.evaluate(() => { const G = window.__GAME.G; return [G.wagers[0], G.players[0].score]; }));
  await p.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.tv-card .wg button[data-f="0.5"]')?.click(); });
  console.log('pick', JSON.stringify(await sim(8, ['card'])));
  await p.evaluate(() => document.querySelector('.tv-card [data-a=ready]')?.click()); await sim(.2);
  await shot('es_secret');
  await p.evaluate(() => window.__GAME.setAuto(true));
  console.log('es end', JSON.stringify(await sim(60, ['end'])));
  await sim(5); await p.waitForTimeout(300);
  console.log('es results', await p.evaluate(() => ({ count: window.__GAME.resultsCount, cards: document.querySelectorAll('.ig-results').length, title: document.querySelector('.ig-results h2')?.textContent, kicker: document.querySelector('.ig-results .ig-kicker')?.textContent })));
  await shot('es_results');
  // portrait phone
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen,.tv-card').forEach(e => e.remove()); window.__GAME.setAuto(false); window.__GAME.start({ humans: 1, lang: 'en', kids: false }); });
  console.log('p q', JSON.stringify(await sim(6, ['buzz'])));
  await shot('p_question');
  await p.evaluate(() => window.__GAME.buzz(0)); await sim(1.2);
  await shot('p_answer');
  await p.evaluate(() => { window.__GAME.G.cur && window.__GAME.answer(window.__GAME.G.cur.correct); }); await sim(.8);
  await shot('p_correct');
  await p.evaluate(() => { window.__GAME.G.phase = 'end'; window.__GAME.title(); }); await p.waitForTimeout(300);
  await shot('p_title');
};
