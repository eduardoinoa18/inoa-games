// Hub party console: Start a party, a phone joins with the code, the console shows the code + a dot per phone.
module.exports = async ({ open, shot, wait, log }) => {
  const hub = await open('index.html', { label: 'hub', h: 900 }); await hub.waitForTimeout(1500);
  await hub.evaluate(() => document.getElementById('party').scrollIntoView());
  await hub.evaluate(() => document.getElementById('pcHost').click()); await wait(hub, () => document.querySelector('.inoa-pp .code'));
  const code = await hub.$eval('.inoa-pp .code', e => e.textContent.trim()); await hub.evaluate(() => document.querySelector('.inoa-pp [data-x]').click());
  const pad = await open('index.html', { w: 390, h: 844, label: 'phone' }); await pad.waitForTimeout(800);
  await pad.evaluate(c => { document.getElementById('pcJoinCode').value = c; document.querySelector('#pcJoin button').click(); }, code);
  await wait(pad, () => window.__PAD && window.__PAD.net.me, null, 20000);
  await wait(hub, () => document.querySelectorAll('#pcDots i').length === 1, null, 10000);
  log('hub console', await hub.$eval('#pcLive', e => e.textContent.trim()), 'button:', await hub.$eval('#pcHost', e => e.textContent));
  await hub.evaluate(() => document.getElementById('pconsole').scrollIntoView({ block: 'center' }));
  await shot(hub, 'console');
  await hub.setViewportSize({ width: 390, height: 844 }); await hub.evaluate(() => document.getElementById('pconsole').scrollIntoView()); await shot(hub, 'console_portrait');
};
