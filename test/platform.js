// Platform end-to-end test: real account.html + a real game page + engine/platform.js against the mock Supabase
// (test/platform/mock-supabase.js) on a fresh copy of the real migrations (RLS + RPC on Postgres 16).
// usage: node test/run.js account.html test/platform.js   (and W=390 H=844 for portrait)   needs the local Postgres from test/db/README.md
const { execSync } = require('child_process'), path = require('path');
module.exports = async (p, shot) => {
  const log = (...a) => console.log('platform', ...a); let fails = 0;
  const ok = (c, m) => { if (c) log('ok -', m); else { fails++; log('FAIL -', m); } };
  const portrait = p.viewportSize().width < p.viewportSize().height, MP = portrait ? 54322 : 54321, DB = portrait ? 'inoa_e2e_p' : 'inoa_e2e';
  execSync(`bash ${path.join(__dirname, 'db/setup.sh')} ${DB}`, { stdio: 'pipe' });
  const mock = await require('./platform/mock-supabase.js')({ port: MP, db: DB });
  const api = (pth, init) => fetch(`http://localhost:${MP}${pth}`, Object.assign({ headers: { apikey: 'test-anon-key', 'content-type': 'application/json' } }, init)).then(r => r.json());
  const sql = (q, params) => api('/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) });
  await p.route('**/platform.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, supabaseUrl: `http://localhost:${MP}`, supabaseAnonKey: 'test-anon-key', stripeMode: 'test' }) }));
  const base = p.url().replace(/account\.html.*$/, '');
  const until = (fn, ms = 20000) => p.waitForFunction(fn, null, { timeout: ms });
  const openLink = async (u) => { await p.goto('about:blank'); await p.goto(u); }; // an email link is a fresh page load, never an in-page #hash change
  try {
    // ---- guest progress on this device (to import later) ----
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('inoa.profile', JSON.stringify({ v: 2, name: 'Guest', xp: 9000, coins: 50, games: { runner: { plays: 4, best: 1269 } }, lang: 'en' })); });
    await p.goto(base + 'account.html?next=games%2Fjunk.html'); await until(() => window.__READY === true);
    ok(await p.isVisible('#vAuth'), 'signed out → sign-in form'); await shot('signin');
    // ---- sign up ----
    await p.click('#tUp'); await p.fill('#iName', 'Ana <b>'); await p.fill('#iEmail', 'ana@example.test'); await p.fill('#iPass', 'short'); await p.click('#bAuth');
    ok((await p.textContent('#mAuth')).length > 0, 'validation message for a bad name/short password');
    await p.fill('#iName', 'Ana'); await p.fill('#iPass', 'correct-horse-1'); await p.click('#bAuth'); await until(() => /13/.test(document.getElementById('mAuth').textContent));
    ok(true, 'sign-up refused until the 13+/parent box is ticked'); await p.check('#iAge'); await p.click('#bAuth'); await until(() => !document.getElementById('vCheck').hidden);
    ok(true, 'sign-up → "check your email"'); await shot('check_email');
    // ---- unverified login is refused ----
    await p.click('#bBackIn'); await p.fill('#iEmail', 'ana@example.test'); await p.fill('#iPass', 'correct-horse-1'); await p.click('#bAuth'); await until(() => document.getElementById('mAuth').textContent.length > 0);
    ok(await p.isVisible('#vAuth'), 'unverified email cannot sign in');
    // ---- verification link (tokens in the #hash are consumed and removed from the URL) ----
    const out = await api('/__test/outbox'); ok(out.some(o => o.type === 'signup' && o.email === 'ana@example.test' && /account\.html/.test(o.redirect || '')), 'verification email queued with a same-site redirect');
    const link = (await api(`/__test/confirm?email=ana@example.test&redirect=${encodeURIComponent(base + 'account.html?next=games%2Fjunk.html')}`)).link;
    await openLink(link); await until(() => window.__READY === true && !document.getElementById('vMe').hidden);
    ok(!p.url().includes('access_token'), 'tokens stripped from the address bar');
    ok((await p.textContent('#meName')) === 'Ana', 'profile name from sign-up');
    ok(/3 of 3/.test(await p.textContent('#planInfo')), 'free plan shows 3 of 3 starts');
    // ---- local progress import (once, capped) ----
    ok(await p.isVisible('#bImport'), 'import offer shown for on-device progress'); await p.click('#bImport'); await until(() => /5000/.test(document.getElementById('sXp').textContent));
    ok(true, 'import capped at 5000 XP'); ok(!(await p.isVisible('#bImport')), 'import offered only once'); await shot('account');
    // ---- the game gate: Play on a real game page consumes a start ----
    await p.goto(base + 'games/junk.html'); await until(() => window.__READY === true, 120000);
    await p.click('.ig-title [data-a=play]'); await until(() => !document.querySelector('.ig-title'), 30000);
    let st = (await sql("select starts from public.ig_daily_usage d join auth.users u on u.id = d.user_id where u.email = 'ana@example.test'"))[0];
    ok(st && st.starts === 1, 'Play pressed → 1 start used (server)');
    // results go to the server: XP is clamped to the per-round cap and shown on the card
    await sql("update public.ig_game_sessions set started_at = started_at - interval '2 minutes'");
    const card = await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); E.results({ gameId: 'junk', title: 'Test', stats: [], xp: 99999, coins: 99999, best: 30, bestLower: true }); await new Promise(r => setTimeout(r, 1500)); return document.querySelector('.ig-results .ig-reward span').textContent; });
    ok(card === '+400 XP', 'results card shows the server-clamped reward (+400 XP), got ' + card);
    const prof = (await sql("select xp from public.ig_profiles p join auth.users u on u.id = p.id where u.email = 'ana@example.test'"))[0];
    ok(prof.xp === 5400, 'server XP = 5000 imported + 400 round');
    // reload keeps the session (same tab key) → no extra start
    await p.reload(); await until(() => window.__READY === true, 120000); await p.click('.ig-title [data-a=play]'); await until(() => !document.querySelector('.ig-title'), 30000);
    st = (await sql("select starts from public.ig_daily_usage d join auth.users u on u.id = d.user_id where u.email = 'ana@example.test'"))[0]; ok(st.starts === 1, 'reload + Play reuses the session (still 1 start)');
    // use the other two starts, then a fresh tab hits the limit gate
    await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); const P = await E.platform(); await P.startGame('fit'); await P.startGame('drift'); sessionStorage.clear(); });
    await p.reload(); await until(() => window.__READY === true, 120000); await p.click('.ig-title [data-a=play]'); await until(() => !!document.querySelector('.ig-gate'), 30000);
    ok(/3 free starts/.test(await p.textContent('.ig-gate h2')), 'fourth start → daily-limit card'); ok(await p.isVisible('.ig-gate a[href*="pricing.html"]'), 'limit card offers Premium'); await shot('limit');
    // client-side tampering does not help
    await p.evaluate(() => { localStorage.setItem('inoa.status.u.x', '{"st":{"plan":"premium"}}'); sessionStorage.clear(); });
    const tam = await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); const P = await E.platform(); return (await P.startGame('tray')).reason; });
    ok(tam === 'limit', 'faking premium in localStorage does not bypass the limit');
    // ---- shared device: sign out, sign in as Ben → nothing of Ana stays ----
    await p.goto(base + 'account.html'); await until(() => window.__READY === true); await p.click('#bOut'); await until(() => !document.getElementById('vAuth').hidden);
    const leftovers = await p.evaluate(() => Object.keys(localStorage).filter(k => (/\.u\./.test(k) && !/\.u\.x$/.test(k)) || k === 'inoa.auth' || k === 'inoa.queue'));
    ok(leftovers.length === 0, 'sign-out removes the per-user caches and session (' + leftovers.join(',') + ')');
    await p.click('#tUp'); await p.fill('#iName', 'Ben'); await p.fill('#iEmail', 'ben@example.test'); await p.fill('#iPass', 'battery-staple-2'); await p.check('#iAge'); await p.click('#bAuth'); await until(() => !document.getElementById('vCheck').hidden);
    await openLink((await api(`/__test/confirm?email=ben@example.test&redirect=${encodeURIComponent(base + 'account.html')}`)).link); await until(() => window.__READY === true && !document.getElementById('vMe').hidden);
    ok((await p.textContent('#meName')) === 'Ben' && (await p.textContent('#sXp')) === '0', "Ben sees his own fresh profile, not Ana's");
    // ---- password reset ----
    await p.click('#bOut'); await until(() => !document.getElementById('vAuth').hidden); await p.click('#bForgot'); await p.fill('#iEmail2', 'ana@example.test'); await p.click('#fForgot button[type=submit]'); await until(() => document.getElementById('mForgot').textContent.length > 0);
    await p.fill('#iEmail2', 'nobody@example.test'); await p.click('#fForgot button[type=submit]');
    ok(/new link|enlace/.test(await p.textContent('#mForgot')), 'reset answer is the same for unknown emails (no enumeration)');
    await openLink((await api(`/__test/confirm?email=ana@example.test&type=recovery&redirect=${encodeURIComponent(base + 'account.html')}`)).link); await until(() => window.__READY === true && !document.getElementById('vReset').hidden);
    await p.fill('#iNew', 'new-password-3'); await p.click('#fReset button'); await until(() => !document.getElementById('vMe').hidden, 10000);
    await p.click('#bOut'); await until(() => !document.getElementById('vAuth').hidden);
    await p.fill('#iEmail', 'ana@example.test'); await p.fill('#iPass', 'new-password-3'); await p.click('#bAuth'); await until(() => !document.getElementById('vMe').hidden);
    ok((await p.textContent('#meName')) === 'Ana', 'password reset works; Ana signs in with the new password');
    // ---- Spanish UI ----
    await p.click('.lang [data-l=es]'); ok((await p.textContent('#bOut')) === 'Cerrar sesión', 'account page switches to Spanish'); await shot('account_es');
  } catch (e) { fails++; log('FAIL - exception', e.message.split('\n')[0]); }
  await mock.close();
  console.log(fails ? `PLATFORM_E2E_FAILED (${fails})` : 'PLATFORM_E2E_PASSED');
};
