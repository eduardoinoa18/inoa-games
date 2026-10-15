// Draws the store/launcher art sources into app/resources/ (vector redraw of icons/icon-512.png, so 1024 px stays sharp):
//   icon-only.png (1024, opaque - App Store marketing icon), icon-foreground.png + icon-background.png (Android adaptive, 1024),
//   splash.png + splash-dark.png (2732, opaque). Then `npm run assets` (@capacitor/assets) writes every native size.
// usage (from app/): node scripts/make_resources.mjs      (uses Playwright + Chromium from the repo root node_modules)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(APP, '..', 'package.json'));
const { chromium } = require('playwright');
const sharp = createRequire(path.join(APP, 'package.json'))('sharp'); // comes with @capacitor/assets
const OUT = path.join(APP, 'resources'); fs.mkdirSync(OUT, { recursive: true });
const font = (pkg, w) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(APP, `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`)).toString('base64');
const NIGHT = '#0b2a3a', SEA = '#0f5c6e';
// the artwork in the original 512 design space: sun (cut by the horizon at y=268), 4 reflection bars, "IG"
const sun = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc85c"/><stop offset="1" stop-color="#ff8a4c"/></linearGradient>
  <clipPath id="above"><rect x="0" y="0" width="512" height="268"/></clipPath></defs>
  <circle cx="256" cy="240" r="195" fill="url(#g)" clip-path="url(#above)"/>
  <g fill="#ffc85c"><rect x="80" y="292" width="352" height="10"/><rect x="115" y="315" width="282" height="10"/><rect x="150" y="338" width="212" height="10"/><rect x="185" y="361" width="142" height="10"/></g>
  <text x="256" y="458" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="132" fill="#eef8f6" letter-spacing="-2">IG</text>`;
const bg = (h, size = 1024) => `<rect width="${size}" height="${size}" fill="${NIGHT}"/><rect y="${h}" width="${size}" height="${size - h}" fill="${SEA}"/>`;
// full icon: art scaled x2. Adaptive layers: @capacitor/assets insets them 16.7% (the image = the visible 72dp), so the art only needs to sit
// inside the 66dp safe circle (92% of the image): scale 1.85 about the centre keeps it at ~80% of that circle; background horizon aligned.
const S_FG = 1.85, H_FG = 512 + (268 - 256) * S_FG;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const ART = {
  'icon-only.png': [1024, 1024, svg(1024, 1024, bg(536) + `<g transform="scale(2)">${sun}</g>`)],
  'icon-foreground.png': [1024, 1024, svg(1024, 1024, `<g transform="translate(512 512) scale(${S_FG}) translate(-256 -256)">${sun}</g>`)],
  'icon-background.png': [1024, 1024, svg(1024, 1024, bg(H_FG))],
};
// splash: icon tile (rounded) + wordmark centred inside the middle ~1200 px (the generator centre-crops for every device)
const splash = (dark) => svg(2732, 2732, `<rect width="2732" height="2732" fill="${dark ? '#071c27' : NIGHT}"/>
  <defs><clipPath id="r"><rect x="1066" y="926" width="600" height="600" rx="132"/></clipPath></defs>
  <g clip-path="url(#r)"><g transform="translate(1066 926) scale(${600 / 1024})">${bg(536)}<g transform="scale(2)">${sun}</g></g></g>
  <text x="1366" y="1700" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="120" fill="#fff6ea">Inoa <tspan fill="#ffc85c">Games</tspan></text>`);
ART['splash.png'] = [2732, 2732, splash(false)];
ART['splash-dark.png'] = [2732, 2732, splash(true)];

const css = `@font-face{font-family:Unbounded;font-weight:900;src:url(${font('unbounded', 900)})}html,body{margin:0;background:transparent}svg{display:block}`;
const b = await chromium.launch();
for (const [name, [w, h, s]] of Object.entries(ART)) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<!doctype html><style>${css}</style>${s}`); await p.evaluate(() => document.fonts.ready);
  const png = await p.screenshot({ omitBackground: name === 'icon-foreground.png' }); await p.close();
  // stores reject alpha in the iOS marketing icon; only the adaptive foreground keeps transparency
  const img = sharp(png); await (name === 'icon-foreground.png' ? img : img.removeAlpha()).png().toFile(path.join(OUT, name)); console.log('wrote resources/' + name);
}
await b.close();
