#!/usr/bin/env node
// Builds app/www: the copy of the deployable site that the Capacitor iOS/Android wrappers ship inside the app.
// usage (repo root): node tools/build_app_www.mjs [--site https://games.example.com]   (or INOA_SITE=... env)
//   then: cd app && npx cap sync
// What it does (the web site itself is never modified; only the copy in app/www):
//  1. copies the deployable files (same exclusions as .vercelignore, plus api/, app/, store/, admin.html, sw.js, and the legacy
//     packs/<game>.json bundles when packs/<game>/manifest.json exists - the engine loader tries the manifest first)
//  2. VENDORS three.js r170 (build/three.module.js + every examples/jsm file the pages import, with their relative deps) into
//     vendor/three/ and rewrites each page's import map to relative paths: no remotely loaded code (Apple 2.5.2), works offline
//  3. vendors the Google Fonts used (Manrope, Unbounded, Press Start 2P; latin subset woff2 from @fontsource in app/node_modules)
//  4. skips service-worker registration when running inside Capacitor (files are already local)
//  5. app-only beta rules: pricing.html replaced by a "free during the beta" page, upgrade/billing buttons hidden (no payments
//     in the apps), account API calls (api/account-delete) pointed at the live site when --site is given
//  6. writes app-build.json {native, version, built, three, site} and verifies no jsDelivr / Google Fonts URL is left
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app'), OUT = path.join(APP, 'www');
const THREE_VER = '0.170.0', CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}/`;
const argSite = (() => { const i = process.argv.indexOf('--site'); return i > 0 ? process.argv[i + 1] : null; })();
const SITE = String(argSite || process.env.INOA_SITE || '').replace(/\/$/, '');
const log = (...a) => console.log('[app:www]', ...a);
const die = (m) => { console.error('[app:www] ERROR:', m); process.exit(1); };

/* ---------- 1. what to copy ---------- */
const vercelIgnore = fs.existsSync(path.join(ROOT, '.vercelignore')) ? fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')) : [];
const EXTRA_EXCLUDE = ['.git', '.gitignore', '.vercelignore', '.vercel', '.claude', '.github', 'app', 'store', 'api', 'node_modules', 'vercel.json',
  'admin.html',        // owner dashboard: web only (server-side refuses non-admins anyway)
  'sw.js'];            // Capacitor serves files from the app bundle; no service worker needed
const globToRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\/$/, '') + '(/|$)');
const EXCLUDE = [...vercelIgnore, ...EXTRA_EXCLUDE].map(globToRe);
const EXCLUDE_ANY = [...vercelIgnore, ...EXTRA_EXCLUDE].filter(g => !g.replace(/\/$/, '').includes('/') && g.includes('*')).map(globToRe); // e.g. *.md at any depth
const excluded = (rel) => EXCLUDE.some(re => re.test(rel)) || EXCLUDE_ANY.some(re => re.test(path.posix.basename(rel))) || /(^|\/)\.DS_Store$/.test(rel);
// legacy base64 packs are only a fallback for a missing manifest (engine/inoa3d.js loadPack); skip them when the manifest exists
const legacyPackSkipped = (rel) => { const m = rel.match(/^packs\/([a-z0-9_-]+)\.json$/); return m && fs.existsSync(path.join(ROOT, 'packs', m[1], 'manifest.json')); };

if (!fs.existsSync(path.join(ROOT, 'node_modules/three/build/three.module.js'))) die('node_modules/three missing - run `npm install` in the repo root first');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let nFiles = 0, nBytes = 0; const skipped = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${ent.name}` : ent.name;
    if (excluded(rel)) { if (!dir) skipped.push(rel); continue; }
    if (ent.isDirectory()) { walk(rel); continue; }
    if (legacyPackSkipped(rel)) { skipped.push(rel); continue; }
    const dst = path.join(OUT, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), dst);
    nFiles++; nBytes += fs.statSync(dst).size;
  }
})('');
log(`copied ${nFiles} files (${(nBytes / 1e6).toFixed(1)} MB); skipped: ${skipped.join(', ')}`);

// every model/hdri a manifest points at must be in the copy (otherwise a game would fall back to a legacy pack we skipped)
for (const d of fs.readdirSync(path.join(OUT, 'packs'), { withFileTypes: true })) {
  const mf = path.join(OUT, 'packs', d.name, 'manifest.json'); if (!d.isDirectory() || !fs.existsSync(mf)) continue;
  const man = JSON.parse(fs.readFileSync(mf, 'utf8')); const base = path.join(path.dirname(mf), man.base || './');
  for (const u of [...Object.values(man.models || {}), ...Object.values(man.hdri || {})]) if (!fs.existsSync(path.join(base, u.split('?')[0]))) die(`packs/${d.name}: missing ${u}`);
}

const files = []; (function list(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) list(f); else files.push(f); } })(OUT);
const textFiles = files.filter(f => /\.(html|js|mjs|css|json|webmanifest)$/.test(f));
const htmlFiles = files.filter(f => f.endsWith('.html'));
const relRoot = (f) => { const depth = path.relative(OUT, path.dirname(f)).split(path.sep).filter(Boolean).length; return depth ? '../'.repeat(depth) : './'; };

/* ---------- 2. vendor three.js ---------- */
const NM3 = path.join(ROOT, 'node_modules/three');
const v3 = JSON.parse(fs.readFileSync(path.join(NM3, 'package.json'), 'utf8')).version;
if (v3 !== THREE_VER) die(`node_modules/three is ${v3}, pages pin ${THREE_VER}`);
const VEND = path.join(OUT, 'vendor/three');
const vendored = new Set();
function vendor(rel) { // rel inside the three package, e.g. 'examples/jsm/loaders/GLTFLoader.js'; follows relative imports
  rel = path.posix.normalize(rel); if (vendored.has(rel)) return; const src = path.join(NM3, rel);
  if (!fs.existsSync(src)) die(`three file not found: ${rel}`); vendored.add(rel);
  const dst = path.join(VEND, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
  if (!rel.endsWith('.js')) return; const code = fs.readFileSync(src, 'utf8');
  for (const m of code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2] || m[3]; if (!spec) continue;
    if (spec === 'three') continue;                                 // resolved by the page's import map
    if (spec.startsWith('.')) vendor(path.posix.join(path.posix.dirname(rel), spec));
    else if (spec.startsWith('three/addons/')) vendor('examples/jsm/' + spec.slice(13));
    else console.warn('[app:www] warning: unresolved bare import', spec, 'in', rel);
  }
}
vendor('build/three.module.js'); if (fs.existsSync(path.join(NM3, 'build/three.core.js'))) vendor('build/three.core.js');
for (const f of textFiles) { // every three/addons/* import (static or dynamic) in pages, engine and games
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/['"]three\/addons\/([^'"]+\.js)['"]/g)) vendor('examples/jsm/' + m[1]);
  for (const m of t.matchAll(new RegExp(CDN.replace(/[.]/g, '\\.') + '(examples/jsm/[^\'"\\s]+\\.js)', 'g'))) vendor(m[1]);
}
fs.copyFileSync(path.join(NM3, 'LICENSE'), path.join(VEND, 'LICENSE'));
log(`vendored three r${v3.split('.')[1]}: ${vendored.size} files`);

/* ---------- 2b. other jsDelivr npm scripts (e.g. engine/net.js: peerjs, qrcode-generator) ---------- */
// Any 'https://cdn.jsdelivr.net/npm/<pkg>@<ver>/<file>' left in pages/scripts is copied from app/node_modules/<pkg> (the exact
// version must be installed there: `cd app && npm i -D --save-exact <pkg>@<ver>`) into vendor/npm/<pkg>@<ver>/<file>.
// In ES modules the URL becomes new URL(<relative>, import.meta.url) so it resolves the same from every page depth.
const NPM_CDN = /(['"`])https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@([0-9][^/'"`]*)\/([^'"`?#]+)\1/gi;
const vendoredNpm = new Set();
for (const f of textFiles.filter(f => /\.(html|js|mjs)$/.test(f))) {
  let t = fs.readFileSync(f, 'utf8'); const before = t;
  t = t.replace(NPM_CDN, (all, q, pkg, ver, file) => {
    if (pkg === 'three') return all;                                   // handled by the import map rewrite
    const pdir = path.join(APP, 'node_modules', pkg), pj = path.join(pdir, 'package.json');
    if (!fs.existsSync(pj)) die(`${path.relative(OUT, f)} loads ${pkg}@${ver} from jsDelivr: install it in app/ (npm i -D --save-exact ${pkg}@${ver})`);
    const have = JSON.parse(fs.readFileSync(pj, 'utf8')).version; if (have !== ver) die(`${pkg}: page wants ${ver}, app/node_modules has ${have}`);
    const src = path.join(pdir, file); if (!fs.existsSync(src)) die(`${pkg}@${ver}: ${file} not in the npm package`);
    const rel = `vendor/npm/${pkg}@${ver}/${file}`, dst = path.join(OUT, rel);
    if (!vendoredNpm.has(rel)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); for (const l of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) if (fs.existsSync(path.join(pdir, l))) fs.copyFileSync(path.join(pdir, l), path.join(OUT, `vendor/npm/${pkg}@${ver}`, l)); vendoredNpm.add(rel); }
    const relFromFile = relRoot(f) + rel;
    return /\.m?js$/.test(f) && /\b(import|export)\b/.test(t) ? `new URL(${q}${relFromFile}${q}, import.meta.url).href` : `${q}${relFromFile}${q}`;
  });
  if (t !== before) fs.writeFileSync(f, t);
}
if (vendoredNpm.size) log(`vendored ${vendoredNpm.size} other npm script(s): ${[...vendoredNpm].join(', ')}`);

/* ---------- 3. fonts ---------- */
const FS_DIR = path.join(APP, 'node_modules/@fontsource');
const FONTS = [['Manrope', 'manrope', [500, 600, 700, 800]], ['Unbounded', 'unbounded', [600, 700, 800, 900]], ['Press Start 2P', 'press-start-2p', [400]]];
let fontsOk = fs.existsSync(FS_DIR);
if (fontsOk) {
  const FD = path.join(OUT, 'vendor/fonts'); fs.mkdirSync(FD, { recursive: true }); let css = '/* Vendored from @fontsource (SIL Open Font License 1.1), latin subset. Replaces Google Fonts in the app build. */\n';
  for (const [fam, pkg, weights] of FONTS) for (const w of weights) {
    const fn = `${pkg}-latin-${w}-normal.woff2`, src = path.join(FS_DIR, pkg, 'files', fn);
    if (!fs.existsSync(src)) { fontsOk = false; console.warn('[app:www] warning: missing font', fn); continue; }
    fs.copyFileSync(src, path.join(FD, fn));
    css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${fn}) format('woff2')}\n`;
  }
  for (const [, pkg] of FONTS) { const lic = path.join(FS_DIR, pkg, 'LICENSE'); if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(FD, `LICENSE-${pkg}.txt`)); }
  fs.writeFileSync(path.join(FD, 'fonts.css'), css);
} else console.warn('[app:www] warning: app/node_modules/@fontsource missing (run `npm install` in app/); pages fall back to system fonts');

/* ---------- 4/5. rewrite pages + scripts ---------- */
const SW_GUARD = /'serviceWorker' in navigator/g;
const NATIVE = `!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) && 'serviceWorker' in navigator`;
const APP_STYLE = '<style id="inoa-app">#bUpgrade,#bPortal,[href*="pricing.html"]{display:none!important}</style>';
for (const f of textFiles) {
  let t = fs.readFileSync(f, 'utf8'); const before = t; const r = relRoot(f), isHtml = f.endsWith('.html');
  // three.js import map -> vendored copy
  t = t.split(CDN).join(`${r}vendor/three/`);
  // Google Fonts -> vendored fonts (or nothing: CSS stacks fall back to system fonts)
  if (isHtml) {
    t = t.replace(/<link[^>]+rel="preconnect"[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, '');
    t = t.replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*>/g, fontsOk ? `<link rel="stylesheet" href="${r}vendor/fonts/fonts.css">` : '');
  }
  // service worker: not needed in the native shell
  if (/\.(html|js)$/.test(f)) t = t.replace(SW_GUARD, NATIVE);
  // account/billing API calls are relative ('api/...'): in the app they must go to the live site (needs CORS there, see docs/APP_STORES.md)
  if (SITE && isHtml) t = t.replace(/fetch\('api\//g, `fetch('${SITE}/api/`);
  // no purchase entry points in the apps (App Store 3.1.1 / Play payments policy): hide upgrade + billing UI
  if (isHtml && path.relative(OUT, f) === 'account.html') {
    t = t.replace('</head>', APP_STYLE + '</head>');
    // e-mail verification / password-reset links must open the real site (capacitor://localhost or https://localhost mean nothing
    // in a mail client); the player confirms on the web, then signs in inside the app
    if (SITE) t = t.split('location.origin + location.pathname').join(`'${SITE}/account.html'`);
  }
  if (t !== before) fs.writeFileSync(f, t);
}
// pricing.html: replaced by a native-only "everything is free in the beta" page (the engine's premium gate links here)
fs.writeFileSync(path.join(OUT, 'pricing.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Inoa Games - Beta</title><link rel="stylesheet" href="engine/ui.css">${fontsOk ? '<link rel="stylesheet" href="vendor/fonts/fonts.css">' : ''}
<style>body{display:grid;place-items:center;min-height:100%;background:#0b2a3a;padding:max(24px,env(safe-area-inset-top)) 20px max(24px,env(safe-area-inset-bottom))}.c{max-width:420px;text-align:center}.c p{line-height:1.5;opacity:.9}</style></head>
<body><div class="c ig-card"><h1 id="t">Free during the beta</h1><p id="d">Every game in this app is free while we test it with players. There is nothing to buy.</p><p><a class="ig-btn" id="b" href="index.html">Back to the games</a></p></div>
<script>try{var es=(JSON.parse(localStorage.getItem('inoa.profile')||'{}').lang||navigator.language||'').slice(0,2)==='es';if(es){document.documentElement.lang='es';t.textContent='Gratis durante la beta';d.textContent='Todos los juegos de esta app son gratis mientras los probamos con jugadores. No hay nada que comprar.';b.textContent='Volver a los juegos';}}catch(e){}</script></body></html>`);

/* ---------- 6. build info + checks ---------- */
const appPkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'app-build.json'), JSON.stringify({ native: true, version: appPkg.version, built: new Date().toISOString(), three: v3, site: SITE || null }, null, 1) + '\n');
const left = [];
for (const f of files.filter(f => /\.(html|js|css)$/.test(f))) { if (!fs.existsSync(f)) continue; const t = fs.readFileSync(f, 'utf8'); if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|unpkg\.com|cdnjs\./.test(t)) left.push(path.relative(OUT, f)); }
if (left.length) die('remote code/font URLs still present in: ' + left.join(', '));
for (const f of htmlFiles) { const t = fs.readFileSync(f, 'utf8'); const m = t.match(/<script type="importmap">([\s\S]*?)<\/script>/); if (!m) continue; const map = JSON.parse(m[1]).imports; for (const k in map) { const target = path.resolve(path.dirname(f), map[k]); if (!fs.existsSync(target)) die(`${path.relative(OUT, f)}: import map ${k} -> ${map[k]} does not exist`); } }
if (!SITE) console.warn('[app:www] note: no --site given; account deletion/billing API calls stay relative (they only work once --site points at the deployed site)');
let total = 0; (function du(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) du(f); else total += fs.statSync(f).size; } })(OUT);
log(`done: app/www ${(total / 1e6).toFixed(1)} MB, ${htmlFiles.length} pages, fonts ${fontsOk ? 'vendored' : 'system fallback'}, version ${appPkg.version}`);
