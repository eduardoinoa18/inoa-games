// Free-beta end-to-end (the shipped default): platform.json mode "beta" + server access_mode 'beta_free'.
// Guests play without an account; feedback works from a game (guest) and is stored with game + device context;
// the hub shows the beta strip; a signed-in player is on plan "beta" with no daily limit; pricing shows "free during the beta".
// usage: node test/run.js junk test/beta.js   (and W=390 H=844)   needs the local Postgres from test/db/README.md
const { execSync } = require('child_process'), path = require('path');
module.exports = async (p, shot) => {
  const log = (...a) => console.log('beta', ...a); let fails = 0;
  const ok = (c, m) => { if (c) log('ok -', m); else { fails++; log('FAIL -', m); } };
  const portrait = p.viewportSize().width < p.viewportSize().height, MP = portrait ? 54342 : 54341, DB = portrait ? 'inoa_beta_p' : 'inoa_beta';
  execSync(`bash ${path.join(__dirname, 'db/setup.sh')} ${DB}`, { stdio: 'pipe', env: Object.assign({}, process.env, { MODE: 'beta_free' }) });
  const mock = await require('./platform/mock-supabase.js')({ port: MP, db: DB });
  const api = (pth, init) => fetch(`http://localhost:${MP}${pth}`, Object.assign({ headers: { apikey: 'test-anon-key', 'content-type': 'application/json' } }, init)).then(r => r.json());
  const sql = (q, params) => api('/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) });
  await p.route('**/platform.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, mode: 'beta', guestPlay: true, billing: false, feedback: true, version: '0.9.0-beta', supabaseUrl: `http://localhost:${MP}`, supabaseAnonKey: 'test-anon-key', stripeMode: 'test' }) }));
  const base = p.url().replace(/games\/.*$/, '');
  const until = (fn, ms = 30000) => p.waitForFunction(fn, null, { timeout: ms });
  try {
    await p.evaluate(() => localStorage.clear());
    // ---- guest plays a game without an account ----
    await p.goto(base + 'games/junk.html'); await until(() => window.__READY === true && document.querySelector('.ig-title [data-a=play]'), 120000);
    await p.click('.ig-title [data-a=play]'); await until(() => !document.querySelector('.ig-title') || document.querySelector('.ig-gate'));
    ok(!(await p.$('.ig-gate')) && !(await p.$('.ig-title')), 'guest presses Play → game starts (no sign-in gate in the beta)');
    // ---- feedback from the game's settings ----
    await p.evaluate(async () => { const E = await import('../engine/inoa3d.js'); await E.platform(); E.settingsPanel(); });
    await until(() => document.querySelector('.ig-settings [data-a=feedback]'));
    ok(true, 'settings panel offers "Send feedback"');
    await p.click('.ig-settings [data-a=feedback]'); await until(() => document.querySelector('.igfb'));
    await p.click('.igfb [data-a=send]'); ok(/face|carita/i.test(await p.textContent('.igfb-msg')), 'empty feedback asks for a face or note');
    await p.click('.igfb [data-r="2"]'); await p.click('.igfb [data-k="bug"]'); await p.fill('.igfb textarea', 'The sander <b>sticks</b> on my phone');
    await shot('feedback');
    await p.click('.igfb [data-a=send]'); await until(() => !document.querySelector('.igfb'));
    const row = (await sql("select game_id, rating, kind, body, context, user_id from public.ig_feedback order by id desc limit 1"))[0] || {};
    ok(row.game_id === 'junk' && row.rating === 2 && row.kind === 'bug' && !/[<>]/.test(row.body) && row.context.platform === 'web' && row.context.version === '0.9.0-beta' && row.user_id === null, 'guest feedback stored with game, rating, kind, sanitized text and device context');
    await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]')?.click());
    // ---- hub: beta strip with optional sign-in + feedback ----
    await p.goto(base + 'index.html'); await until(() => document.getElementById('betaBar'));
    ok(/Free beta/.test(await p.textContent('#betaBar')) && /optional/.test(await p.textContent('#bbAcct')) && !!(await p.$('#bbFb')), 'hub shows the beta strip, optional sign-in and feedback');
    await p.click('#langToggle [data-l="es"]'); await until(() => /Beta gratis/.test(document.getElementById('betaBar').textContent));
    ok(true, 'beta strip follows the hub language (ES)'); await p.click('#langToggle [data-l="en"]');
    await shot('hub');
    // ---- signed-in player: plan "beta", no daily limit ----
    await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: 'tester@example.test', password: 'password-123', data: { display_name: 'Tess', app: 'inoa' } }) }); await api('/__test/confirm?email=tester@example.test');
    await p.goto(base + 'account.html'); await until(() => window.__READY === true);
    await p.fill('#iEmail', 'tester@example.test'); await p.fill('#iPass', 'password-123'); await p.click('#bAuth'); await until(() => !document.getElementById('vMe').hidden && document.getElementById('planName').textContent);
    ok((await p.textContent('#planName')) === 'Free beta' && /free while we test/.test(await p.textContent('#planInfo')) && await p.isHidden('#bUpgrade'), 'account page: "Free beta", everything unlocked, no upgrade button');
    await shot('account');
    // ---- invite: Tess shares her link, a friend signs up through it and confirms → Tess gets $1 credit ----
    await until(() => /ref=[A-Z2-9]{6}/.test(document.getElementById('invUrl').value));
    const invite = await p.inputValue('#invUrl'); ok(/index\.html\?ref=[A-Z2-9]{6}$/.test(invite) && /0 of 5/.test(await p.textContent('#invInfo')), 'account shows an invite link and 0 of 5 this month');
    await p.evaluate(async () => (await import('./engine/platform.js')).default.signOut());
    await p.goto(invite); await until(() => document.getElementById('betaBar'));
    await p.goto(base + 'account.html'); await until(() => window.__READY === true);
    await p.click('#tUp'); await p.fill('#iName', 'Ray'); await p.fill('#iEmail', 'ray@example.test'); await p.fill('#iPass', 'password-123'); await p.check('#iAge'); await p.click('#bAuth'); await until(() => !document.getElementById('vCheck').hidden);
    const pend = (await sql("select r.status from public.ig_referrals r join auth.users u on u.id = r.referred_id where u.email = 'ray@example.test'"))[0];
    ok(pend && pend.status === 'pending', 'friend who signed up from the invite link is attributed (pending until email confirmed)');
    await api('/__test/confirm?email=ray@example.test');
    await p.evaluate(async () => (await import('./engine/platform.js')).default.signOut().catch(() => { }));
    await p.goto(base + 'account.html'); await until(() => window.__READY === true);
    await p.fill('#iEmail', 'tester@example.test'); await p.fill('#iPass', 'password-123'); await p.click('#bAuth'); await until(() => /1 of 5/.test(document.getElementById('invInfo')?.textContent || ''));
    ok(/1\.00/.test(await p.textContent('#invInfo')) && /Ray/.test(await p.textContent('#invList')), 'inviter sees 1 of 5 and $1.00 credit, friend listed by name');
    await shot('invite');
    const starts = await p.evaluate(async () => { const P = (await import('./engine/platform.js')).default; await P.init(); const out = []; for (const g of ['drift', 'fit', 'tray', 'brew', 'trivia']) { sessionStorage.clear(); const r = await P.startGame(g); out.push(r.allowed && r.access); } return out; });
    ok(starts.every(a => a === 'beta'), 'five game starts in one day all allowed (beta, no counter): ' + starts.join(','));
    await p.goto(base + 'index.html'); await until(() => /Tess/.test(document.getElementById('betaBar')?.textContent || ''));
    ok(true, 'hub account chip shows the signed-in player');
    // ---- pricing: free during the beta, no buy button ----
    await p.goto(base + 'pricing.html'); await until(() => window.__READY === true);
    ok(/free during the beta/i.test(await p.textContent('h1')) && await p.isHidden('.plans'), 'pricing says everything is free during the beta (no plans, no checkout)');
  } catch (e) { fails++; log('FAIL - exception', e.message); await shot('fail').catch(() => { }); }
  await mock.close();
  log(fails ? `BETA_E2E_FAILED (${fails})` : 'BETA_E2E_PASSED'); if (fails) process.exitCode = 1;
};
