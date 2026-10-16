// Tide Runner with a phone as the controller: stick right = one lane right (an edge, not auto-repeat), A = jump, B = slide.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/runner.html', { label: 'runner' }); await ready(host);
  await host.click('[data-a=phones]'); await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); await host.click('.inoa-pp [data-x]');
  const pad = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad' }); await wait(pad, () => window.__PAD.net.me);
  await host.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await host.evaluate(() => { const g = window.__GAME; for (let i = 0; i < 90; i++) g.update(1 / 60); g.G.invT = 99; });
  const step = n => host.evaluate(n => { const g = window.__GAME; for (let i = 0; i < n; i++) g.update(1 / 60); return { lane: g.G.lane, vy: g.G.vy, slide: g.G.slideT, state: g.G.state }; }, n);
  const s0 = await step(1);
  await pad.evaluate(() => { const z = document.getElementById('stickZone'); const r = z.getBoundingClientRect(); const o = { pointerId: 7, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; z.dispatchEvent(new PointerEvent('pointerdown', o)); z.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: o.clientX + 60 })); });
  await host.waitForTimeout(600); const s1 = await step(40); // holding the stick must not keep changing lanes
  await pad.evaluate(() => { const z = document.getElementById('stickZone'); z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })); });
  await host.waitForTimeout(400); await step(5);
  log('phone stick', JSON.stringify({ before: s0.lane, after: s1.lane }));
  if (s1.lane !== s0.lane + 1) throw new Error('phone stick did not move exactly one lane');
  await pad.locator('#bA').dispatchEvent('pointerdown'); await host.waitForTimeout(500); const s2 = await step(2); await pad.locator('#bA').dispatchEvent('pointerup');
  log('phone A', JSON.stringify(s2)); if (!(s2.vy > 0)) throw new Error('phone A did not jump');
  await host.waitForTimeout(300); await step(60);
  await pad.locator('#bB').dispatchEvent('pointerdown'); await host.waitForTimeout(500); const s3 = await step(2); await pad.locator('#bB').dispatchEvent('pointerup');
  log('phone B', JSON.stringify(s3)); if (!(s3.slide > 0)) throw new Error('phone B did not slide');
  await shot(host, 'runner_phone');
};
