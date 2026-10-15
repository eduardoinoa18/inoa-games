// Host approval ("no strangers"): a new phone must be let in on the big screen; Deny keeps it out with a clear message,
// Allow lets it in, and an approved phone rejoins silently after the host switches games.
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/runner.html', { label: 'host' });
  await host.addInitScript(() => { window.__NO_AUTO_APPROVE = 1; }); await host.evaluate(() => { window.__NO_AUTO_APPROVE = 1; });
  await ready(host);
  await host.click('[data-a=phones]'); await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); log('room', code);
  // stranger: denied
  const s = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'stranger' });
  await wait(host, () => document.querySelector('.inoa-approve'), null, 60000);
  await wait(s, () => /Asking to join/.test(document.body.textContent), null, 30000); log('phone sees: asking to join');
  await shot(host, 'approve_card');
  await host.click('.inoa-approve [data-v="0"]');
  await wait(s, () => /did not let you in/.test(document.getElementById('err')?.textContent || ''), null, 30000); log('denied phone told it was not let in');
  const n1 = await host.evaluate(async () => (await import('/engine/inoa3d.js')).net.pads().length); log('pads after deny', n1);
  if (n1 !== 0) throw new Error('denied phone got in');
  // friend: allowed
  const f = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'friend' });
  await wait(host, () => document.querySelector('.inoa-approve'), null, 60000); await host.click('.inoa-approve .ok');
  await wait(f, () => window.__PAD && window.__PAD.net.status === 'ready' && window.__PAD.net.me, null, 60000); log('allowed phone joined as', await f.evaluate(() => window.__PAD.net.me.name));
  // host switches games: approved phone rejoins with no new prompt
  await host.goto(host.url().replace('runner.html', 'fit.html')); await ready(host);
  await wait(host, async () => { const E = await import('/engine/inoa3d.js'); return E.net.status === 'ready' && E.net.pads().length === 1; }, null, 60000);
  const prompt = await host.$('.inoa-approve'); log('prompt after game switch', !!prompt);
  if (prompt) throw new Error('approved phone was asked again');
};
