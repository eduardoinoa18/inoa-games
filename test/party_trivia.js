// Pact Trivia with phones: two phones join, each becomes a player; the question shows on the phone,
// a phone buzzes in, gets the 4 choices privately and answers; scores update on the big screen.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/trivia.html?online=1', { label: 'host' }); await ready(host);
  await wait(host, () => document.querySelector('.inoa-pp .code'), null, 30000);
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); log('room', code);
  const a = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'padA' });
  await a.evaluate(() => localStorage.setItem('inoa.pad', JSON.stringify({ name: 'Ana' })));
  await wait(a, () => window.__PAD.net.me);
  const b = await open('pad.html?join=' + code, { w: 390, h: 844, label: 'padB' });
  await wait(b, () => window.__PAD.net.me);
  await host.click('.inoa-pp [data-x]');
  log('title line:', await host.$eval('#tvPhones', e => e.textContent));
  await host.evaluate(() => document.querySelector('[data-a=play]').click());
  const step = async n => { for (let i = 0; i < n; i += 10) { await host.evaluate(() => { for (let j = 0; j < 10; j++) window.__GAME.update(1 / 20); }); await host.waitForTimeout(30); } };
  log('players', await host.evaluate(() => window.__GAME.G.players.map(p => p.name + (p.slot ? '#' + p.slot : '')).join(',')));
  for (let i = 0; i < 40; i++) { await step(10); if (await host.evaluate(() => window.__GAME.G.phase === 'buzz')) break; }
  await a.waitForTimeout(500);
  await wait(a, () => !document.getElementById('buzz').hidden, null, 8000);
  log('pad A sees question:', await a.$eval('#bq', e => e.textContent.slice(0, 80)));
  await shot(a, 'padA_buzzer');
  await a.locator('#buzz').dispatchEvent('pointerdown'); await a.waitForTimeout(150); await a.locator('#buzz').dispatchEvent('pointerup');
  await wait(host, () => window.__GAME.G.phase === 'answer', null, 8000);
  await step(2);
  await wait(a, () => !document.getElementById('choices').hidden, null, 8000);
  log('pad B shows:', await b.$eval('#msg', e => e.textContent));
  await shot(a, 'padA_choices'); await shot(host, 'host_answering');
  const correct = await host.evaluate(() => window.__GAME.G.cur.correct);
  await a.locator('#copts button').nth(correct).dispatchEvent('pointerdown');
  await wait(host, () => window.__GAME.G.players[0].score > 0, null, 8000);
  log('scores', await host.evaluate(() => window.__GAME.G.players.map(p => p.score).join(',')));
  await step(4); await a.waitForTimeout(400);
  log('pad A after:', await a.$eval('#msg', e => e.textContent.replace(/\n/g, ' ')));
};
