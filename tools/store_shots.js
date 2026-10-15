// App Store / Google Play screenshots + Play feature graphic, rendered with the real games through the test harness.
// usage (repo root):  PORT=8890 node test/run.js index tools/store_shots.js
//   STORE_DEVICES=iphone69,ipad13,android   (default: all)     STORE_GAMES=hub,drift,runner,...   (default: all below)
//   STORE_LANG=en|es (default en)          STORE_FEATURE=0 skips the feature graphic
// Output: store/screenshots/<device>/<NN>_<shot>[_es].jpg (JPEG q92, no alpha) and store/feature-graphic.png (1024x500, no alpha).
// Software WebGL is slow at these sizes: each game step is simulated with window.__GAME.update() (like test/*.js), then one frame is
// rendered for the screenshot. The renderer is held at quality 'high' so the auto-quality drop never blurs a shot.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), NM3 = path.join(ROOT, 'node_modules/three/');
const OUT = path.join(ROOT, 'store');
const DEVICES = { // CSS viewport x deviceScaleFactor = required pixel size
  iphone69: { width: 440, height: 956, dsf: 3, touch: true },      // 1320 x 2868  (App Store 6.9" iPhone)
  ipad13: { width: 1032, height: 1376, dsf: 2, touch: true },      // 2064 x 2752  (App Store 13" iPad)
  android: { width: 432, height: 768, dsf: 2.5, touch: true },     // 1080 x 1920  (Google Play phone)
};
const LANG = process.env.STORE_LANG === 'es' ? 'es' : 'en';
// a believable mid-game profile (local only), so the hub shows a hero, levels and the Continue row instead of a blank first run
const PROFILE = { v: 2, name: LANG === 'es' ? 'Isla' : 'Isla', xp: 2650, coins: 840, games: { drift: { plays: 6, best: 42.8 }, runner: { plays: 9, best: 1420 }, brew: { plays: 3, best: 12 }, trivia: { plays: 4, best: 2400 } }, recent: ['drift', 'runner', 'brew'], lang: LANG, voice: false, sound: false, music: false, motion: 'auto', quality: 'high', hero: { model: 'skater-female', color: '#ff7a59' } };

const sim = (p, sec, opts = {}) => p.evaluate(async ({ sec, cam, until }) => {
  const g = window.__GAME; const f = until ? new Function('G', 'return ' + until) : null;
  for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (cam && g.updateCamera) g.updateCamera(1 / 60); if (f && g.G && f(g.G)) return i; if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); }
  return -1;
}, { sec, cam: !!opts.cam, until: opts.until || null });
const play = async (p) => { await p.waitForSelector('.ig-title [data-a=play]', { timeout: 180000 }); await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); };

// Each recipe gets the page with the game loaded (title screen) and leaves it on a good-looking gameplay moment.
const SHOTS = {
  // hub: the web hero banner ("one link, no download") is web copy, so the shot starts at the daily challenge / Continue row / shelf
  // (scrolling + screenshots is flaky in mobile emulation, so the banner is hidden instead of scrolled past)
  hub: { page: 'index.html', async run(p) { await p.addStyleTag({ content: 'body>header{display:none!important}' }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(2500); } },
  // drift: player-driven start (no autopilot) like the reference test; the chase camera follows in the render loop
  drift: { page: 'games/drift.html', async run(p) { await play(p); await p.waitForTimeout(400); await sim(p, 7); } },
  runner: { page: 'games/runner.html', async run(p) { await play(p); await sim(p, .6, { cam: true }); await p.evaluate(() => { window.__GAME.auto = true; }); await sim(p, 6, { cam: true }); } },
  brew: {
    page: 'games/brew.html', async run(p) {
      await p.evaluate(() => window.__GAME.setHour && window.__GAME.setHour(16.5)); await play(p); await sim(p, .5);
      for (const [i, seed] of [[0, 'mint'], [1, 'cham'], [2, 'lav']]) { await p.evaluate(() => window.__GAME.update(1 / 60)); await p.evaluate(({ i, seed }) => { const labs = document.querySelectorAll('.bb-lab:not(.ing):not(.bb-order)'); if (!labs[i]) return; labs[i].click(); const b = document.querySelector(`.bb-sheet [data-s=${seed}]`) || document.querySelector('.bb-sheet [data-s=mint]'); if (b) b.click(); }, { i, seed }); }
      await p.evaluate(() => window.__GAME.ff(470)); await sim(p, 2); await p.evaluate(() => window.__GAME.tend()); await sim(p, 16);
    }
  },
  trivia: { page: 'games/trivia.html', async run(p) { await p.evaluate(() => { localStorage.removeItem('inoa.trivia.seen'); }); await play(p); await p.evaluate(async () => { const g = window.__GAME; for (let i = 0; i < 6 * 30; i++) { g.update(1 / 30); if (g.G && (g.G.phase === 'buzz' || g.G.phase === 'answer')) break; if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } }); } },
  tidelines: { page: 'games/tidelines.html', async run(p) { await play(p); await sim(p, 1.6, { cam: true }); await p.evaluate(() => { window.__GAME.auto = true; }); await sim(p, 16, { cam: true }); await sim(p, 10, { cam: true, until: 'G.me && G.me.alive' }); await sim(p, .5, { cam: true }); } },
  junk: {
    page: 'games/junk.html', async run(p) {
      await play(p); await p.waitForTimeout(300); await sim(p, .6);
      for (let stage = 0; stage < 2; stage++) for (let i = 0; i < 12; i++) { const s0 = await p.evaluate(() => window.__GAME.G.stage); await p.evaluate(() => window.__GAME.autoScrub(1)); await sim(p, .3); const s1 = await p.evaluate(() => ({ st: window.__GAME.G.stage, ph: window.__GAME.G.phase })); if (s1.st !== s0 || s1.ph !== 'play') { await sim(p, 1.5); break; } }
      await p.evaluate(() => window.__GAME.autoScrub(.55)); await sim(p, .6);
    }
  },
};

async function fontCss() { // Google Fonts are unreachable in the sandbox: serve the same families from @fontsource as data URLs
  const FS = path.join(ROOT, 'app/node_modules/@fontsource'); if (!fs.existsSync(FS)) return null;
  const list = [['Manrope', 'manrope', [500, 600, 700, 800]], ['Unbounded', 'unbounded', [600, 700, 800, 900]], ['Press Start 2P', 'press-start-2p', [400]]];
  let css = ''; for (const [fam, pkg, ws] of list) for (const w of ws) { const f = path.join(FS, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`); if (fs.existsSync(f)) css += `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2')}\n`; }
  return css;
}

async function newContext(browser, dev, css) {
  const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.dsf, hasTouch: dev.touch, isMobile: dev.touch && dev.width < 900, serviceWorkers: 'block' });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)/, r => { const rel = r.request().url().split('three@0.170.0/')[1].split('?')[0]; r.fulfill({ body: fs.readFileSync(NM3 + rel), contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.googleapis\.com/, r => css ? r.fulfill({ body: css, contentType: 'text/css' }) : r.abort());
  await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  await ctx.addInitScript(([prof]) => { try { if (!sessionStorage.getItem('__store_seeded')) { localStorage.clear(); localStorage.setItem('inoa.profile', prof); sessionStorage.setItem('__store_seeded', '1'); } } catch (e) { } }, [JSON.stringify(PROFILE)]);
  return ctx;
}

async function waitReady(p) {
  for (let i = 0; i < 240; i++) { await p.waitForTimeout(500); const ok = await p.evaluate(() => window.__READY === true || (document.getElementById('loading') ? document.getElementById('loading').hidden : !document.querySelector('.ig-loading'))).catch(() => false); if (ok) break; }
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => { }); await p.waitForTimeout(800);
}

async function featureGraphic(browser, css, base) {
  const img = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'thumbs', n + '.jpg')).toString('base64');
  const icon = 'data:image/png;base64,' + fs.readFileSync(fs.existsSync(path.join(ROOT, 'app/resources/icon-only.png')) ? path.join(ROOT, 'app/resources/icon-only.png') : path.join(ROOT, 'icons/icon-512.png')).toString('base64');
  const tiles = ['drift', 'brew', 'runner', 'tidelines', 'junk', 'trivia'];
  const html = `<!doctype html><style>${css || ''}html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#0b2a3a;font-family:Manrope,sans-serif}
  .wall{position:absolute;inset:-60px -40px -60px 380px;display:grid;grid-template-columns:repeat(2,330px);gap:14px;transform:rotate(-8deg);transform-origin:center}
  .wall img{width:330px;height:186px;object-fit:cover;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .wall img:nth-child(even){transform:translateY(60px)}
  .fade{position:absolute;inset:0;background:linear-gradient(90deg,#0b2a3a 0%,#0b2a3a 33%,rgba(11,42,58,.6) 46%,rgba(11,42,58,0) 58%)}
  .brand{position:absolute;left:56px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:18px;width:420px}
  .row{display:flex;align-items:center;gap:18px}.row img{width:96px;height:96px;border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
  h1{margin:0;font-family:Unbounded;font-weight:900;font-size:50px;line-height:1;color:#fff6ea;letter-spacing:-.02em}h1 span{color:#ffc85c}
  p{margin:0;color:#cfe6ea;font-weight:700;font-size:23px;line-height:1.35}</style>
  <div class="wall">${tiles.map(t => `<img src="${img(t)}">`).join('')}</div><div class="fade"></div>
  <div class="brand"><div class="row"><img src="${icon}"><h1>Inoa<br><span>Games</span></h1></div><p>${LANG === 'es' ? '13 juegos para jugar solo o en familia. Un héroe en todos.' : '13 games to play solo or with the whole couch. One hero in all of them.'}</p></div>`;
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const f = path.join(OUT, `feature-graphic${LANG === 'es' ? '_es' : ''}.png`); await p.screenshot({ path: f }); await ctx.close(); console.log('[store] wrote', path.relative(ROOT, f));
}

module.exports = async (p0) => {
  const browser = p0.context().browser(); const base = new URL(p0.url()).origin + '/';
  const css = await fontCss(); if (!css) console.warn('[store] app/node_modules/@fontsource missing (cd app && npm install): shots use fallback fonts');
  const devs = (process.env.STORE_DEVICES || Object.keys(DEVICES).join(',')).split(',').filter(d => DEVICES[d]);
  const shots = (process.env.STORE_GAMES || Object.keys(SHOTS).join(',')).split(',').filter(s => SHOTS[s]);
  if (process.env.STORE_FEATURE !== '0') await featureGraphic(browser, css, base);
  for (const d of devs) {
    const dir = path.join(OUT, 'screenshots', d); fs.mkdirSync(dir, { recursive: true });
    for (const name of shots) {
      const S = SHOTS[name], idx = String(Object.keys(SHOTS).indexOf(name) + 1).padStart(2, '0'), T0 = Date.now();
      const ctx = await newContext(browser, DEVICES[d], css); const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message)); p.setDefaultTimeout(600000);
      try {
        await p.goto(base + S.page); await waitReady(p);
        await S.run(p);
        // hide transient UI that would date the shot (toasts, install offers) and let one full frame render
        await p.addStyleTag({ content: '.ig-toast,.ig-install{display:none!important}' }).catch(() => { });
        await p.evaluate(() => { window.__HOLD = false; window.__NORENDER = false; }); await p.waitForTimeout(1500);
        const f = path.join(dir, `${idx}_${name}${LANG === 'es' ? '_es' : ''}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 600000 });
        console.log('[store]', d, name, `${((Date.now() - T0) / 1000).toFixed(0)}s`, errs.length ? 'ERR ' + errs[0].slice(0, 160) : 'ok');
      } catch (e) { console.log('[store]', d, name, 'FAILED', e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
};
