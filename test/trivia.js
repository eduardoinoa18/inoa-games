// Pact Trivia headless test.
// Bank sanity → Classic solo vs 3 bots (buzz, wrong answer, steal, auto-play to results) → Full show (true/false,
// your pick by keyboard, closest number typed exactly, results) → no repeats in the next show → bot accuracy per skill →
// Daily 10 (same set for everyone, saved once, practice run) → 4 local players in Spanish kids mode (keys, touch,
// gamepad, wager, secret answer) → portrait phone shots (true/false, pick, number dial).
module.exports = async (p) => {
  // portrait runs (W<H) get a _p suffix so they never overwrite the landscape shots
  const SUF = process.env.SUFFIX ?? (Number(process.env.H || 560) > Number(process.env.W || 1000) ? '_p' : '');
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/trivia_' + n + SUF + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  // run the game loop until a predicate (source string, sees g = __GAME and G) is true
  const until = (sec, pred) => p.evaluate(async ({ sec, pred }) => { const g = window.__GAME, f = new Function('g', 'G', 'return ' + (pred || 'false')); for (let i = 0; i < sec * 20; i++) { g.update(1 / 20); if (g.G && f(g, g.G)) break; if (i % 100 === 0) await new Promise(r => setTimeout(r, 0)); } const G = g.G; return G ? { phase: G.phase, qi: G.qi, round: G.seq[G.qi]?.round, scores: G.players.map(x => x.score) } : null; }, { sec, pred });
  const sim = (sec, phases) => until(sec, phases ? `${JSON.stringify(phases)}.includes(G.phase) || (${JSON.stringify(phases)}.includes('card') && !!(G.wagerCard || G.fcard))` : null);
  const log = (k, v) => console.log(k, typeof v === 'string' ? v : JSON.stringify(v));
  const fail = m => console.error('FAIL ' + m);

  log('bank', await p.evaluate(() => { const g = window.__GAME, by = {}; g.Q.forEach(r => { by[r[0]] = (by[r[0]] || 0) + 1; }); return { mc: g.Q.length, tf: g.TF.length, num: g.NUM.length, kidsMC: g.Q.filter(r => r[1] === 1).length, cats: Object.keys(by).length, ids: new Set(g.BANK.m.map(o => o.id)).size }; }));
  await shot('title');
  const PORTRAIT = SUF === '_p';
  if (!PORTRAIT) {
  // ---------- Classic: solo vs 3 bots ----------
  await p.evaluate(() => { localStorage.removeItem('inoa.trivia.seen2'); localStorage.removeItem('inoa.trivia.stats'); window.__GAME.S.lang = 'en'; window.__GAME.S.botSkill = 'normal'; document.querySelector('#pS [data-s=classic]').click(); document.querySelector('.ig-title [data-a=play]').click(); });
  log('classic intro', await sim(12, ['buzz']));
  log('classic plan', await p.evaluate(() => window.__GAME.G.seq.map(e => e.round + ':' + e.q.kind).join(',')));
  await shot('question');
  await p.evaluate(() => window.__GAME.buzz(0)); await sim(1.2);
  await shot('answer');
  await p.evaluate(() => { const G = window.__GAME.G; window.__GAME.answer((G.cur.correct + 1) % 4); }); // wrong on purpose → steal
  await sim(.4); await shot('wrong');
  log('after wrong', await sim(2.5, ['steal']));
  log('steal', await sim(5, ['answer', 'result']));
  await shot('steal');
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('to final', await sim(220, ['fread', 'freveal']));
  await shot('final');
  log('end', await sim(60, ['end']));
  await sim(1.5); await shot('winner');
  await sim(4); await p.waitForTimeout(500); await shot('results');
  log('classic results', await p.evaluate(() => ({ card: !!document.querySelector('.ig-results'), count: window.__GAME.resultsCount, plays: JSON.parse(localStorage.getItem('inoa.profile')).games.trivia.plays })));

  // ---------- Full show: buzz-in → true/false → your pick → closest number → All In ----------
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); window.__GAME.setAuto(false); window.__GAME.start({ humans: 1, lang: 'en', kids: false, mode: 'full' }); });
  log('full plan', await p.evaluate(() => window.__GAME.G.seq.map(e => e.round).join(',')));
  log('round intro', await until(6, "G.phase === 'roundIntro'"));
  await shot('round_intro');
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('to tf', await until(120, "G.seq[G.qi]?.round === 'tf' && G.phase === 'read'"));
  await p.evaluate(() => window.__GAME.setAuto(false));
  log('tf buzz', await until(4, "G.phase === 'buzz'"));
  await shot('tf');
  const tf = await p.evaluate(() => { const G = window.__GAME.G; return { ch: G.cur.ch, correct: G.cur.correct, kind: G.cur.kind }; }); log('tf q', tf);
  await p.keyboard.press('Space'); await until(.2);
  log('tf panel', await p.evaluate(() => [...document.querySelectorAll('#tvChoices .tv-ch')].map(b => b.textContent)));
  await shot('tf_answer');
  const before = await p.evaluate(() => window.__GAME.G.players[0].score);
  await p.keyboard.press('Digit' + (tf.correct + 1)); await until(.5);
  log('tf correct +', (await p.evaluate(() => window.__GAME.G.players[0].score)) - before);
  // your pick: make player 1 trail so the human picks with the keyboard
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('to pick', await until(120, "G.seq[G.qi]?.round === 'pick' && G.phase === 'roundIntro'"));
  await p.evaluate(() => { const g = window.__GAME; g.setAuto(false); g.G.players[0].score = -500; });
  log('pick', await until(5, "G.phase === 'pick'"));
  await shot('pick');
  const pk = await p.evaluate(() => { const G = window.__GAME.G; return { who: G.pickInfo.who, cats: G.pickInfo.cats, panel: [...document.querySelectorAll('#tvChoices .tv-ch')].length }; }); log('pick info', pk);
  await p.keyboard.press('Digit2'); await until(2, "G.phase === 'buzz'");
  log('picked cat', await p.evaluate(c => { const G = window.__GAME.G; return { sel: G.pickInfo.sel, qCat: G.cur.cat, ok: G.cur.cat === c }; }, pk.cats[1]));
  // closest number: player 1 trails → guesses first; type the exact answer
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('to num', await until(150, "G.seq[G.qi]?.round === 'num' && G.phase === 'roundIntro'"));
  await p.evaluate(() => { const g = window.__GAME; g.setAuto(false); g.G.players[0].score = -500; });
  log('num turn', await until(8, "G.phase === 'nguess'"));
  const nq = await p.evaluate(() => { const G = window.__GAME.G; return { ni: G.ni, ans: G.cur.ans, min: G.cur.min, max: G.cur.max, step: G.cur.step, q: G.cur.q }; }); log('num q', nq);
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowLeft'); await until(.2);
  await shot('num');
  for (const ch of String(nq.ans)) await p.keyboard.press('Digit' + ch);
  log('typed', await p.evaluate(() => [window.__GAME.G.typed, document.getElementById('tvNum')?.textContent]));
  await p.keyboard.press('Enter');
  log('num reveal', await until(12, "G.phase === 'result'"));
  log('num result', await p.evaluate(() => { const G = window.__GAME.G; return { guesses: G.guesses, win: G.numWin, me: G.players[0].score }; }));
  await until(.6); await shot('num_reveal');
  const asked = await p.evaluate(() => window.__GAME.G.seq.filter(e => e.q).map(e => e.q.id));
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('full end', await sim(160, ['end']));
  await sim(5); await p.waitForTimeout(300);
  log('full results', await p.evaluate(() => ({ count: window.__GAME.resultsCount, cards: document.querySelectorAll('.ig-results').length, title: document.querySelector('.ig-results h2')?.textContent })));
  // recently asked: the next show must not repeat this show's questions
  log('repeats next show', await p.evaluate(asked => { const d = window.__GAME.buildShow('full'); const ids = d.seq.filter(e => e.q).map(e => e.q.id).concat(d.fin.id); return ids.filter(id => asked.includes(id)).length; }, asked));
  log('cat stats', await p.evaluate(() => localStorage.getItem('inoa.trivia.stats')));

  // ---------- bot accuracy per skill (2000 trials each, Profe Pip / Lucky Lalo) ----------
  log('bot acc', await p.evaluate(() => { const g = window.__GAME, out = {}; for (const sk of ['easy', 'normal', 'hard']) out[sk] = [{ acc: [.95, .85, .7] }, { acc: [.62, .48, .38] }].map(b => [1, 2, 3].map(d => { let k = 0; for (let i = 0; i < 2000; i++) if (g.botKnows(b, d, sk)) k++; return Math.round(k / 20); }).join('/')).join(' · '); return out; }));

  // ---------- Daily 10 ----------
  await p.evaluate(() => { window.__GAME.setAuto(false); document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); localStorage.removeItem('inoa.trivia.daily'); window.__DAY = '2026-10-16'; window.__GAME.title(); });
  await p.evaluate(() => document.querySelector('#pS [data-s=daily]').click());
  await shot('daily_title');
  log('daily same set', await p.evaluate(() => { const g = window.__GAME, a = g.buildShow('daily').seq.map(e => e.q.id + e.q.correct), b = g.buildShow('daily').seq.map(e => e.q.id + e.q.correct); window.__DAY = '2026-10-17'; const c = g.buildShow('daily').seq.map(e => e.q.id); window.__DAY = '2026-10-16'; return { n: a.length, same: a.join() === b.join(), otherDayDiffers: c.join() !== a.map(x => x.slice(0, -1)).join(), diffs: g.buildShow('daily').seq.map(e => e.q.d).join('') }; }));
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  log('daily q1', await until(10, "G.phase === 'answer'"));
  log('daily players', await p.evaluate(() => window.__GAME.G.players.length));
  await shot('daily_answer');
  await p.evaluate(() => { const G = window.__GAME.G; document.querySelector('#tvChoices .tv-ch[data-k="' + G.cur.correct + '"]').click(); });
  await until(.5); log('daily first +', await p.evaluate(() => window.__GAME.G.players[0].score));
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('daily end', await sim(120, ['end']));
  await sim(4); await p.waitForTimeout(300);
  const dres = await p.evaluate(() => ({ count: window.__GAME.resultsCount, title: document.querySelector('.ig-results h2')?.textContent, saved: JSON.parse(localStorage.getItem('inoa.trivia.daily')), marks: window.__GAME.G.marks.join('') })); log('daily results', dres);
  await shot('daily_results');
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); window.__GAME.start({ mode: 'daily' }); window.__GAME.setAuto(true); });
  await sim(200, ['end']); await sim(4);
  log('daily practice keeps first score', await p.evaluate(s => JSON.parse(localStorage.getItem('inoa.trivia.daily')).score === s, dres.saved.score));
  await p.evaluate(() => { window.__GAME.setAuto(false); document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); });

  // ---------- 4 local players, Spanish, kids mode (classic) ----------
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.start({ humans: 4, lang: 'es', kids: true, bots: false, mode: 'classic' }); });
  log('es q', await sim(12, ['buzz']));
  await shot('es_buzz');
  log('lang sync', await p.evaluate(() => { const g = window.__GAME, G = g.G; const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); return { profile: pr.lang, docLang: document.documentElement.lang, qIsEs: G.cur.q === G.cur.r[4], kidsOnly: G.seq.every(e => e.q.d === 1) && G.deck.fin.d === 1 }; }));
  await p.keyboard.press('KeyL'); await sim(.1);
  log('kbd buzz P2', await p.evaluate(() => window.__GAME.G.buzzer));
  await p.keyboard.press('Digit' + (await p.evaluate(() => (window.__GAME.G.cur.correct + 1) % 4 + 1)));
  log('kbd wrong (kids: no minus) ->', await sim(4, ['steal']));
  await p.evaluate(() => document.querySelector('.tv-buz[data-c="2"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sim(.1);
  log('touch buzz P3', await p.evaluate(() => window.__GAME.G.buzzer));
  await p.evaluate(() => { const G = window.__GAME.G; const k = [0, 1, 2, 3].find(k => k !== G.cur.correct && !G.out.includes(k)); document.querySelector('.tv-ch[data-k="' + k + '"]').click(); });
  log('touch wrong ->', await sim(4, ['steal']));
  await p.evaluate(() => { const mk = on => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: on && i === 0 })) }); window.__padOn = true; navigator.getGamepads = () => [mk(false), mk(false), mk(false), mk(window.__padOn)]; });
  await sim(.1); await p.evaluate(() => { window.__padOn = false; });
  log('pad buzz P4', [await p.evaluate(() => window.__GAME.G.buzzer), await p.evaluate(() => window.__GAME.G.phase)]);
  log('switch en', await p.evaluate(() => { const g = window.__GAME; g.setLang('en'); const G = g.G; return { qIsEn: G.cur.q === G.cur.r[2], btn: document.querySelector('.tv-ch')?.textContent.slice(0, 30), buz: document.querySelector('.tv-buz')?.textContent }; }));
  await p.evaluate(() => window.__GAME.setLang('es')); await sim(.1);
  await shot('es_answer');
  await p.evaluate(() => window.__GAME.answer(window.__GAME.G.cur.correct)); await sim(.8);
  await shot('es_correct');
  await p.evaluate(() => { window.__GAME.setAuto(true); });
  log('es final', await sim(220, ['finalIntro']));
  await p.evaluate(() => { window.__GAME.setAuto(false); });
  log('wager', await sim(8, ['card']));
  await shot('es_wager');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); // P1 wagers 75% with the keyboard
  log('kbd wager', await p.evaluate(() => { const G = window.__GAME.G; return [G.wagers[0], G.players[0].score]; }));
  await p.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.tv-card .wg button[data-f="0.5"]')?.click(); });
  log('pick', await sim(8, ['card']));
  await p.evaluate(() => document.querySelector('.tv-card [data-a=ready]')?.click()); await sim(.2);
  await shot('es_secret');
  await p.evaluate(() => window.__GAME.setAuto(true));
  log('es end', await sim(60, ['end']));
  log('kids never negative', await p.evaluate(() => window.__GAME.G.players.every(p => p.score >= 0)));
  await sim(5); await p.waitForTimeout(300);
  log('es results', await p.evaluate(() => ({ count: window.__GAME.resultsCount, cards: document.querySelectorAll('.ig-results').length, title: document.querySelector('.ig-results h2')?.textContent, kicker: document.querySelector('.ig-results .ig-kicker')?.textContent })));
  await shot('es_results');

  }
  if (!PORTRAIT) return;
  // ---------- portrait phone (W=390 H=844 run) ----------
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen,.tv-card').forEach(e => e.remove()); window.__GAME.setAuto(false); window.__GAME.start({ humans: 1, lang: 'en', kids: false, mode: 'full' }); });
  log('p q', await until(12, "G.phase === 'buzz'"));
  await shot('p_question');
  await p.evaluate(() => window.__GAME.buzz(0)); await sim(1.2);
  await shot('p_answer');
  await p.evaluate(() => { window.__GAME.G.cur && window.__GAME.answer(window.__GAME.G.cur.correct); }); await sim(.8);
  await shot('p_correct');
  await p.evaluate(() => window.__GAME.setAuto(true));
  await until(120, "G.seq[G.qi]?.round === 'tf' && G.phase === 'read'"); await p.evaluate(() => window.__GAME.setAuto(false));
  await until(4, "G.phase === 'buzz'"); await p.evaluate(() => window.__GAME.buzz(0)); await sim(1);
  await shot('p_tf');
  await p.evaluate(() => window.__GAME.setAuto(true));
  await until(150, "G.seq[G.qi]?.round === 'pick' && G.phase === 'roundIntro'"); await p.evaluate(() => { const g = window.__GAME; g.setAuto(false); g.G.players[0].score = -500; });
  await until(5, "G.phase === 'pick'"); await until(1);
  await shot('p_pick');
  await p.evaluate(() => window.__GAME.pickCat(0)); await p.evaluate(() => window.__GAME.setAuto(true));
  await until(150, "G.seq[G.qi]?.round === 'num' && G.phase === 'roundIntro'"); await p.evaluate(() => { const g = window.__GAME; g.setAuto(false); g.G.players[0].score = -500; });
  log('p num', await until(8, "G.phase === 'nguess'")); await until(1.2);
  await p.evaluate(() => document.querySelector('.tv-nb[data-m="10"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.evaluate(() => document.querySelector('.tv-nb[data-m="10"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  log('p nudge', await p.evaluate(() => { const G = window.__GAME.G; return [G.numVal, (G.cur.min + G.cur.max) / 2]; }));
  await shot('p_num');
  await p.evaluate(() => document.getElementById('tvLock').click());
  log('p num reveal', await until(12, "G.phase === 'result'")); await until(.6);
  await shot('p_num_reveal');
  await p.evaluate(() => { window.__GAME.G.phase = 'end'; window.__GAME.title(); }); await p.waitForTimeout(300);
  await shot('p_title');
};
