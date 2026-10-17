// Cloud game saves end-to-end (roadmap R3): local Postgres + mock Supabase. Needs test/db (see test/db/README.md).
// usage: node test/run.js fit test/cloudsave.js
const { execSync } = require('child_process'), path = require('path');
module.exports = async (p, shot) => {
  const log = (...a) => console.log('cloud', ...a); let fails = 0;
  const ok = (c, m, x) => { if (c) log('ok -', m); else { fails++; log('FAIL -', m, x === undefined ? '' : JSON.stringify(x)); } };
  const MP = 54351, DB = 'inoa_cloud';
  execSync(`bash ${path.join(__dirname, 'db/setup.sh')} ${DB}`, { stdio: 'pipe', env: Object.assign({}, process.env, { MODE: 'beta_free' }) });
  const mock = await require('./platform/mock-supabase.js')({ port: MP, db: DB });
  const api = (pth, init) => fetch(`http://localhost:${MP}${pth}`, Object.assign({ headers: { apikey: 'test-anon-key', 'content-type': 'application/json' } }, init)).then(r => r.json());
  const sql = (q, params) => api('/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, params }) });
  await p.route('**/platform.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, mode: 'beta', guestPlay: true, billing: false, feedback: true, supabaseUrl: `http://localhost:${MP}`, supabaseAnonKey: 'test-anon-key' }) }));
  const base = p.url().replace(/games\/.*$/, '');
  const until = (fn, ms = 30000, arg) => p.waitForFunction(fn, arg, { timeout: ms });
  const signIn = async email => {
    await p.goto(base + 'account.html'); await until(() => window.__READY === true);
    await p.fill('#iEmail', email); await p.fill('#iPass', 'password-123'); await p.click('#bAuth'); await until(() => !document.getElementById('vMe').hidden);
    return p.evaluate(() => JSON.parse(localStorage.getItem('inoa.auth')).user.id);
  };
  const game = async g => { await p.goto(base + `games/${g}.html`); await until(() => window.__READY === true, 120000); };
  const E = (fn, arg) => p.evaluate(async ([src, arg]) => { const E = await import('../engine/inoa3d.js'); return (0, eval)(src)(E, arg); }, [fn.toString(), arg]);
  try {
    for (const [e, n] of [['tess@example.test', 'Tess'], ['ray@example.test', 'Ray']]) { await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: e, password: 'password-123', data: { display_name: n, app: 'inoa' } }) }); await api(`/__test/confirm?email=${e}`); }
    await p.evaluate(() => localStorage.clear());
    // ---- device A: guest progress exists, Tess signs in, plays → her save is hers and reaches the cloud ----
    await p.evaluate(() => localStorage.setItem('inoa.fit', JSON.stringify({ v: 2, legacy: 2 })));
    const tess = await signIn('tess@example.test');
    await game('fit');
    const first = await E(E => E.store.get('inoa.fit', null));
    ok(first && first.legacy === 2, 'first read for a signed-in player starts from this device\'s guest progress', first);
    await E(E => E.store.set('inoa.fit', { v: 2, legacy: 5 }));
    ok(await p.evaluate(u => JSON.parse(localStorage.getItem('inoa.fit.u.' + u)).legacy === 5 && JSON.parse(localStorage.getItem('inoa.fit')).legacy === 2, tess), 'the save is written under the player, the guest copy is untouched');
    let row = null; for (let i = 0; i < 40 && !row; i++) { await p.waitForTimeout(250); row = (await sql("select data, rev from public.ig_saves s join auth.users u on u.id = s.user_id where u.email = 'tess@example.test' and key = 'inoa.fit'"))[0]; }
    ok(row && row.data.legacy === 5, 'save uploaded to the cloud a moment after it changed', row);
    // ---- device B (fresh storage): sign in → progress comes back ----
    await p.evaluate(() => localStorage.clear());
    await signIn('tess@example.test');
    await until(u => { try { return JSON.parse(localStorage.getItem('inoa.fit.u.' + u)).legacy === 5; } catch (e) { return false; } }, 15000, tess);
    await game('fit');
    ok((await E(E => E.store.get('inoa.fit', null))).legacy === 5, 'on a new device the game reads the cloud progress');
    // ---- shared device: sign out removes Tess's synced saves; Ray starts from his own (guest) save ----
    await p.evaluate(() => localStorage.setItem('inoa.fit', JSON.stringify({ v: 2, legacy: 3 })));
    await p.evaluate(async () => { const P = (await import('../engine/platform.js')).default; await P.init(); await P.signOut(); });
    ok(await p.evaluate(u => localStorage.getItem('inoa.fit.u.' + u) === null, tess), 'after sign-out Tess\'s save is no longer on the device');
    await signIn('ray@example.test'); await game('fit');
    ok((await E(E => E.store.get('inoa.fit', null))).legacy === 3, 'the next player never sees Tess\'s progress');
    await p.evaluate(async () => { const P = (await import('../engine/platform.js')).default; await P.init(); await P.signOut(); });
    // ---- newer copy from another device while the game is open → offered, not written underneath ----
    await signIn('tess@example.test'); await game('fit');
    await sql("update public.ig_saves set data = '{\"v\":2,\"legacy\":8}'::jsonb, rev = rev + 1, updated_at = now() + interval '1 minute' where key = 'inoa.fit' and user_id = (select id from auth.users where email = 'tess@example.test')");
    await p.evaluate(async () => { const P = (await import('../engine/platform.js')).default; await P.syncSaves(); });
    await until(() => document.querySelector('.ig-cloud'), 10000);
    ok((await E(E => E.store.get('inoa.fit', null))).legacy === 5, 'the open game\'s save was not overwritten underneath it');
    await shot('offer');
    await Promise.all([p.waitForNavigation(), p.click('.ig-cloud [data-a=load]')]); await until(() => window.__READY === true, 120000);
    ok((await E(E => E.store.get('inoa.fit', null))).legacy === 8, '"Load it" brings the newer progress in');
    // ---- Pixel Pact 2D uses the same rules ----
    await sql("insert into public.ig_saves (user_id, key, data, bytes) select id, 'pixelpact3.progress', '{\"cloudMark\":7}'::jsonb, 16 from auth.users where email = 'tess@example.test'");
    await game('pixelpact');
    await until(() => window.__GAME.progress && window.__GAME.progress.cloudMark === 7, 15000);
    ok(await p.evaluate(u => JSON.parse(localStorage.getItem('pixelpact3.progress.u.' + u)).cloudMark === 7, tess), 'Pixel Pact progress restored from the cloud under the player');
  } catch (e) { fails++; log('FAIL - exception', e.message); await shot('fail').catch(() => { }); }
  await mock.close();
  log(fails ? `CLOUD_E2E_FAILED (${fails})` : 'CLOUD_E2E_PASSED'); if (fails) process.exitCode = 1;
};
