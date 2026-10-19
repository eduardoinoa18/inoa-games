// Serves the site's third-party scripts from our own domain instead of jsDelivr (reliability: a network that blocks or slows
// cdn.jsdelivr.net used to leave every 3D game on an endless loading bar). Same layout as the app build (tools/build_app_www.mjs):
//   vendor/three/build/three.module.js + every examples/jsm file the pages import (with their relative deps)
//   vendor/npm/<pkg>@<ver>/<file> for the other scripts (qrcode-generator, jsQR)
// and rewrites import maps / script URLs in the sources. Re-run after upgrading three (pin in package.json) or adding an addon import.
// usage: node tools/vendor_web.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE_VER = '0.170.0', CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}/`;
const NM3 = path.join(ROOT, 'node_modules/three'), VEND = path.join(ROOT, 'vendor/three');
const die = m => { console.error('[vendor] ERROR:', m); process.exit(1); };
const v3 = JSON.parse(fs.readFileSync(path.join(NM3, 'package.json'), 'utf8')).version; if (v3 !== THREE_VER) die(`node_modules/three is ${v3}, pages pin ${THREE_VER}`);
const SRC_DIRS = ['', 'games', 'engine', 'labs', 'hub-src'];
const srcFiles = SRC_DIRS.flatMap(d => fs.readdirSync(path.join(ROOT, d || '.')).filter(f => /\.(html|js|mjs)$/.test(f)).map(f => path.join(d, f)));
const vendored = new Set();
function vendor(rel) {
  rel = path.posix.normalize(rel); if (vendored.has(rel)) return; const src = path.join(NM3, rel); if (!fs.existsSync(src)) die('three file not found: ' + rel); vendored.add(rel);
  const dst = path.join(VEND, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
  const t = fs.readFileSync(src, 'utf8');
  for (const m of t.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) { const spec = m[1] || m[2]; if (spec === 'three') continue; if (spec.startsWith('.')) vendor(path.posix.join(path.posix.dirname(rel), spec)); else if (spec.startsWith('three/addons/')) vendor('examples/jsm/' + spec.slice(13)); }
}
fs.rmSync(VEND, { recursive: true, force: true });
vendor('build/three.module.js'); if (fs.existsSync(path.join(NM3, 'build/three.core.js'))) vendor('build/three.core.js');
for (const f of srcFiles) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); for (const m of t.matchAll(/['"]three\/addons\/([^'"]+\.js)['"]/g)) vendor('examples/jsm/' + m[1]); }
fs.copyFileSync(path.join(NM3, 'LICENSE'), path.join(VEND, 'LICENSE'));
// other npm scripts
const NPM = [['qrcode-generator', '1.4.4', 'qrcode.js'], ['jsqr', '1.4.0', 'dist/jsQR.js']];
for (const [pkg, ver, file] of NPM) {
  const pdir = [path.join(ROOT, 'node_modules', pkg), path.join(ROOT, 'app/node_modules', pkg)].find(d => fs.existsSync(path.join(d, 'package.json'))) || die(pkg + ' not installed (npm i in the repo root or app/)'), have = JSON.parse(fs.readFileSync(path.join(pdir, 'package.json'), 'utf8')).version; if (have !== ver) die(`${pkg}: want ${ver}, node_modules has ${have}`);
  const dst = path.join(ROOT, 'vendor/npm', `${pkg}@${ver}`, file); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(pdir, file), dst);
  for (const l of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) if (fs.existsSync(path.join(pdir, l))) fs.copyFileSync(path.join(pdir, l), path.join(ROOT, 'vendor/npm', `${pkg}@${ver}`, l));
}
// rewrite sources
let n = 0;
for (const f of srcFiles) {
  const p = path.join(ROOT, f); let t = fs.readFileSync(p, 'utf8'); const before = t; const up = f.includes('/') && !f.startsWith('hub-src') ? '../' : '';
  t = t.split(CDN).join(`${up}vendor/three/`);
  t = t.replace("'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'", "new URL('../vendor/npm/qrcode-generator@1.4.4/qrcode.js', import.meta.url).href");
  t = t.replace("'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'", `'${up}vendor/npm/jsqr@1.4.0/dist/jsQR.js'`);
  if (t !== before) { fs.writeFileSync(p, t); n++; }
}
const left = srcFiles.filter(f => /cdn\.jsdelivr\.net/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
console.log(`[vendor] three r${v3.split('.')[1]}: ${vendored.size} files; ${NPM.length} other scripts; rewrote ${n} source files${left.length ? '; still on jsDelivr: ' + left.join(', ') : ''}`);
