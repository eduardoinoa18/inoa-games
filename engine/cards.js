// Card Room playing cards: original, procedurally drawn faces (no real deck design). Used by games (canvas textures +
// HTML/SVG) and by pad.html's `cards` layout, so a phone shows exactly the same card as the table. No DOM needed for the
// SVG strings; drawCard/drawBack take a 2D canvas context.
// Colour-blind friendly: every suit has its own shape AND its own colour (four-colour deck: spades ink, hearts red,
// diamonds blue, clubs green; jokers purple stars), and the rank is printed big.
// card = {r: 1..13 (0 = joker), s: 'S'|'H'|'D'|'C'|'X'}; null or {back: true} draws the back.

export const SUIT_COLOR = { S: '#1b2430', H: '#d33a2f', D: '#2265b8', C: '#16804f', X: '#7d45c4' };
export const SUIT_NAME = { S: ['spades', 'picas'], H: ['hearts', 'corazones'], D: ['diamonds', 'diamantes'], C: ['clubs', 'tréboles'], X: ['joker', 'comodín'] };
export const RANK_NAME = { 0: ['joker', 'comodín'], 1: ['ace', 'as'], 11: ['jack', 'jota'], 12: ['queen', 'reina'], 13: ['king', 'rey'] };
const star = (cx, cy, R, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * k).toFixed(1) + ' ' + (cy + Math.sin(a) * k).toFixed(1); } return d + 'Z'; };
// suit shapes in a 100 × 100 box (SVG path data; canvas draws the same data through Path2D)
export const SUIT_PATH = {
  H: 'M50 90C22 68 4 50 4 31C4 15 16 5 29 5C39 5 46 11 50 19C54 11 61 5 71 5C84 5 96 15 96 31C96 50 78 68 50 90Z',
  D: 'M50 3L88 50L50 97L12 50Z',
  S: 'M50 4C68 24 94 38 94 60C94 74 84 82 72 82C64 82 58 78 54 72C55 82 59 90 66 96H34C41 90 45 82 46 72C42 78 36 82 28 82C16 82 6 74 6 60C6 38 32 24 50 4Z',
  C: 'M31 27a19 19 0 1 0 38 0a19 19 0 1 0-38 0ZM8 58a19 19 0 1 0 38 0a19 19 0 1 0-38 0ZM54 58a19 19 0 1 0 38 0a19 19 0 1 0-38 0ZM45 52C45 76 40 88 32 96H68C60 88 55 76 55 52Z',
  X: star(50, 52, 47, 20)
};
export const rankLabel = c => !c ? '' : c.r === 0 ? '★' : ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[c.r] || String(c.r));
// spoken / aria name: "7 of hearts" / "7 de corazones"
export function cardName(c, lang = 'en') {
  if (!c || c.back) return lang === 'es' ? 'carta boca abajo' : 'face-down card';
  const es = lang === 'es' ? 1 : 0; if (c.r === 0) return RANK_NAME[0][es];
  const rn = RANK_NAME[c.r] ? RANK_NAME[c.r][es] : String(c.r); return `${rn} ${es ? 'de' : 'of'} ${SUIT_NAME[c.s][es]}`;
}

const BACK_A = '#1f7a8c', BACK_B = '#16596a', BACK_SUN = '#ffd166';
// SVG markup for a card, viewBox 0 0 100 140. opts.badge: small text in the bottom-right corner (e.g. the card's points)
export function cardSvg(c, { badge = null } = {}) {
  if (!c || c.back) return backSvg();
  const col = SUIT_COLOR[c.s] || '#1b2430', rk = rankLabel(c), p = SUIT_PATH[c.s] || SUIT_PATH.S, ten = rk.length > 1;
  return `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="137" rx="11" fill="#fffdf6" stroke="#d9cdb3" stroke-width="3"/>`
    + `<text x="${ten ? 7 : 10}" y="44" font-family="Unbounded,Manrope,system-ui,sans-serif" font-weight="900" font-size="${ten ? 36 : 42}" fill="${col}" letter-spacing="${ten ? -3 : 0}">${rk}</text>`
    + `<path d="${p}" fill="${col}" transform="translate(66 12) scale(.26)"/>`
    + `<path d="${p}" fill="${col}" transform="translate(23 56) scale(.54)"/>`
    + (badge != null ? `<rect x="58" y="113" width="38" height="22" rx="11" fill="${col}"/><text x="77" y="129" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="800" font-size="15" fill="#fff">${badge}</text>` : '')
    + `</svg>`;
}
// an empty pile spot (dashed outline)
export const emptySvg = () => `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="3" y="3" width="94" height="134" rx="11" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-dasharray="8 6"/></svg>`;
export function backSvg() {
  let rings = ''; for (let i = 0; i < 4; i++) rings += `<circle cx="50" cy="70" r="${12 + i * 9}" fill="none" stroke="${BACK_B}" stroke-width="3"/>`;
  return `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="137" rx="11" fill="${BACK_A}" stroke="#fffdf6" stroke-width="3"/><rect x="9" y="9" width="82" height="122" rx="7" fill="none" stroke="#bfe9ee" stroke-width="2" stroke-dasharray="4 4"/>${rings}<path d="${star(50, 70, 13, 6)}" fill="${BACK_SUN}"/></svg>`;
}

// Canvas versions (for three.js textures): w × h, card drawn to fill the canvas
export function drawCard(g, c, w, h, { badge = null } = {}) {
  if (!c || c.back) return drawBack(g, w, h);
  const k = w / 100, col = SUIT_COLOR[c.s] || '#1b2430', rk = rankLabel(c), p = new Path2D(SUIT_PATH[c.s] || SUIT_PATH.S), ten = rk.length > 1;
  g.save(); g.scale(k, h / 140);
  rrect(g, 1.5, 1.5, 97, 137, 11); g.fillStyle = '#fffdf6'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d9cdb3'; g.stroke();
  g.fillStyle = col; g.font = `900 ${ten ? 36 : 42}px Unbounded, Manrope, system-ui, sans-serif`; g.textBaseline = 'alphabetic';
  if (ten) { g.save(); g.translate(7, 44); g.scale(.86, 1); g.fillText(rk, 0, 0); g.restore(); } else g.fillText(rk, 10, 44);
  const put = (x, y, s) => { g.save(); g.translate(x, y); g.scale(s, s); g.fill(p); g.restore(); };
  put(66, 12, .26); put(23, 56, .54);
  if (badge != null) { rrect(g, 58, 113, 38, 22, 11); g.fill(); g.fillStyle = '#fff'; g.font = '800 15px Manrope, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(badge, 77, 129); g.textAlign = 'start'; }
  g.restore();
}
export function drawBack(g, w, h) {
  g.save(); g.scale(w / 100, h / 140);
  rrect(g, 1.5, 1.5, 97, 137, 11); g.fillStyle = BACK_A; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fffdf6'; g.stroke();
  g.setLineDash([4, 4]); g.lineWidth = 2; g.strokeStyle = '#bfe9ee'; rrect(g, 9, 9, 82, 122, 7); g.stroke(); g.setLineDash([]);
  g.strokeStyle = BACK_B; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(50, 70, 12 + i * 9, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = BACK_SUN; g.fill(new Path2D(star(50, 70, 13, 6)));
  g.restore();
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
