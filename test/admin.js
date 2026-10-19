// Owner dashboard end-to-end: admin.html against the mock Supabase on the real migrations.
// Signed out → gate; normal player → gate AND the database refuses admin RPCs; owner (granted by the SQL bootstrap) → KPIs,
// users (Inoa accounts only, not other apps sharing auth), user detail, suspend with audit trail.
// usage: node test/run.js admin.html test/admin.js   (and W=390 H=844)   needs the local Postgres from test/db/README.md
const { execSync } = require('child_process'), path = require('path');
module.exports = async (p, shot) => {
  const log = (...a) => console.log('admin', ...a); let fails = 0;
  const ok = (c, m) => { if (c) log('ok -', m); else { fails++; log('FAIL -', m); } };
  const portrait = p.viewportSize().width < p.viewportSize().height, MP = portrait ? 54332 : 54331, DB = portrait ? 'inoa_adm_p' : 'inoa_adm';
  execSync(`bash ${path.join(__dirname, 'db/setup.sh')} ${DB}`, { stdio: 'pipe' });
  const mock = await require('./platform/mock-supabase.js')({ port: MP, db: DB });
  const api = (pth, init) => fetch(`http://localhost:${MP}${pth}`, Object.assign({ headers: { apikey: 'test-anon-key', 'content-type': 'application/json' } }, init)).then(r => r.json());
  const sql = (q, params) => api('/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) });
  await p.route('**/platform.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, supabaseUrl: `http://localhost:${MP}`, supabaseAnonKey: 'test-anon-key', stripeMode: 'test' }) }));
  const base = p.url().replace(/admin\.html.*$/, '');
  const until = (fn, ms = 20000) => p.waitForFunction(fn, null, { timeout: ms });
  const signup = async (email, name, app = 'inoa') => { await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'password-123', data: { display_name: name, app } }) }); await api(`/__test/confirm?email=${email}`); };
  const signIn = async email => {
    await p.goto(base + 'account.html'); await until(() => window.__READY === true);
    if (await p.isVisible('#vMe')) { await p.evaluate(async () => (await import('./engine/platform.js')).default.signOut()); await p.goto(base + 'account.html'); await until(() => window.__READY === true); }
    await p.fill('#iEmail', email); await p.fill('#iPass', 'password-123'); await p.click('#bAuth'); await until(() => !document.getElementById('vMe').hidden);
  };
  const openAdmin = async () => { await p.goto('about:blank'); await p.goto(base + 'admin.html'); await until(() => window.__READY === true); };
  try {
    await p.evaluate(() => localStorage.clear());
    await openAdmin();
    ok(await p.isVisible('#gate') && !(await p.isVisible('#app')), 'signed out → owner gate, no dashboard'); await shot('gate');
    await signup('owner@example.test', 'Owner'); await signup('ben@example.test', 'Ben'); await signup('cy@example.test', 'Cy');
    await signup('listing@example.test', 'Agent', 'listing-studio'); // another app in the same Supabase project
    // ---- a normal player ----
    await signIn('ben@example.test'); await openAdmin();
    ok(await p.isVisible('#gate') && /not an owner/.test(await p.textContent('#gateP')), 'normal player → gate');
    const denied = await p.evaluate(async () => { const P = (await import('./engine/platform.js')).default; await P.init(); const out = [];
      for (const [fn, args] of [['ig_admin_kpis', { p_days: 30 }], ['ig_admin_list_users', {}], ['ig_admin_set_suspended', { p_user: '00000000-0000-0000-0000-000000000000', p_suspended: true, p_reason: 'x' }]]) {
        try { await P.rpc(fn, args); out.push('allowed'); } catch (e) { out.push(String(e.message || e)); } }
      try { await P.rpc('ig_grant_owner_by_email', { p_email: 'ben@example.test' }); out.push('allowed'); } catch (e) { out.push(String(e.message || e)); }
      return out; });
    ok(denied.every(d => d !== 'allowed'), 'database refuses admin RPCs and the owner bootstrap for a normal player: ' + denied.map(d => d.slice(0, 30)).join(' | '));
    // ---- owner (bootstrap runs as the database owner, like the Supabase SQL editor) ----
    await api('/rest/v1/rpc/ig_log_error', { method: 'POST', body: JSON.stringify({ p: { page: 'tray', kind: 'webgl', message: 'WebGL context lost', detail: { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari', w: 390, h: 844, ready: true } } }) });
    await api('/rest/v1/rpc/ig_submit_feedback', { method: 'POST', body: JSON.stringify({ p_rating: 2, p_body: 'Tray course 3 is too hard', p_game: 'tray', p_kind: 'bug', p_context: { platform: 'web', version: '0.9.0-beta' } }) });
    await sql("select public.ig_grant_owner_by_email('owner@example.test')");
    await signIn('owner@example.test'); await openAdmin();
    ok(await p.isVisible('#app') && !(await p.isVisible('#gate')), 'owner → dashboard');
    await until(() => document.querySelectorAll('#players .tile').length > 0 && document.querySelectorAll('#users tbody tr').length > 0);
    const reg = await p.evaluate(() => [...document.querySelectorAll('#players .tile')].find(t => t.querySelector('span').textContent === 'Registered').querySelector('b').textContent);
    ok(reg === '3', 'Registered counts Inoa accounts only (3), not the other app\'s user: ' + reg);
    const emails = await p.$$eval('#users tbody td:nth-child(2)', t => t.map(x => x.textContent));
    ok(emails.length === 3 && !emails.includes('listing@example.test'), 'user list excludes other apps sharing auth');
    const nGames = +(await sql('select count(*) as n from public.ig_game_catalog'))[0].n; ok(await p.$$eval('#games tbody tr', r => r.length) === nGames, `per-game table lists every catalog game (${nGames})`);
    ok(/\$0\.00/.test(await p.textContent('#revenue')), 'revenue tiles render (test data: $0.00)');
    await until(() => /too hard/.test(document.getElementById('feedback').textContent));
    ok(/guest/.test(await p.textContent('#feedback')) && /1 new/.test(await p.textContent('#fSum')), 'owner sees guest feedback in the inbox');
    ok(/WebGL context lost/.test(await p.textContent('#cerr')) && /iOS 17/.test(await p.textContent('#cerr')) && /tray webgl ×1/.test(await p.textContent('#eSum')), 'owner sees crash reports with device');
    await p.selectOption('#feedback select', 'done'); await until(() => /No feedback here yet/.test(document.getElementById('feedback').textContent));
    ok(true, 'marking feedback done removes it from the New filter');
    await shot('dashboard');
    // ---- search + user detail + suspend (audited) ----
    await p.fill('#q', 'ben'); await until(() => document.querySelectorAll('#users tbody tr').length === 1);
    ok(true, 'search narrows the list');
    await p.click('#users [data-u]'); await until(() => document.getElementById('dlg').open);
    ok((await p.textContent('#dTitle')) === 'Ben', 'user detail opens');
    p.once('dialog', d => d.accept('test: spam'));
    await p.click('#aSusp'); await until(() => /Restore/.test(document.getElementById('aSusp')?.textContent || ''));
    ok(true, 'suspend → button flips to Restore');
    const susp = (await sql("select st.suspended from public.ig_account_status st join auth.users u on u.id = st.user_id where u.email = 'ben@example.test'"))[0];
    ok(susp && susp.suspended === true, 'suspension stored in the database');
    await until(() => /set_suspended|suspend/.test(document.getElementById('audit').textContent));
    ok(true, 'suspension shows in the admin audit log'); await shot('user_detail');
    await p.click('#dClose');
  } catch (e) { fails++; log('FAIL - exception', e.message); await shot('fail').catch(() => { }); }
  await mock.close();
  log(fails ? `ADMIN_E2E_FAILED (${fails})` : 'ADMIN_E2E_PASSED'); if (fails) process.exitCode = 1;
};
