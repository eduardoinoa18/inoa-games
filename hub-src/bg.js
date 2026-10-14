/* Hero backdrop: sky, sun, sea, dunes, the four heroes idling on the beach */
const bg = document.getElementById('bg'), bctx = bg.getContext('2d');
let sun = null;
function buildSun() { sun = document.createElement('canvas'); sun.width = sun.height = 256; const s = sun.getContext('2d'), g = s.createLinearGradient(0, 28, 0, 228); g.addColorStop(0, '#fff8d8'); g.addColorStop(.5, '#ffd27a'); g.addColorStop(1, '#ff7a52'); s.fillStyle = g; s.beginPath(); s.arc(128, 128, 100, 0, TAU); s.fill(); s.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) s.fillRect(0, 140 + i * 15, 256, 3 + i * 2.2); }
let frame = 0, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function drawBg(t) {
  const hdr = bg.parentElement.getBoundingClientRect(), dp = Math.min(devicePixelRatio || 1, 2), W = Math.max(1, Math.round(hdr.width * dp)), H = Math.max(1, Math.round(hdr.height * dp));
  if (bg.width !== W || bg.height !== H) { bg.width = W; bg.height = H; }
  const c = bctx, z = Math.max(1, H / 420) * dp / dp, hz = H * .62;
  const sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#0b3550'); sky.addColorStop(.42, '#2c7a8e'); sky.addColorStop(.72, '#f2977a'); sky.addColorStop(.9, '#ffc982'); sky.addColorStop(1, '#ffe2a8'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const sx = W * .7, sy = hz - 70 * dp, sr = 70 * dp; glow(c, sx, sy, sr * 4, '#ffb070', .55); glow(c, sx, sy, sr * 2, '#fff0c0', .5); c.drawImage(sun, sx - sr * 1.28, sy - sr * 1.28, sr * 2.56, sr * 2.56);
  c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const a = -1.2 + i * .55 + Math.sin(t * .2 + i) * .04; c.fillStyle = 'rgba(255,214,160,.05)'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - .06) * W * 1.4, sy + Math.sin(a - .06) * W * 1.4 + H); c.lineTo(sx + Math.cos(a + .06) * W * 1.4, sy + Math.sin(a + .06) * W * 1.4 + H); c.closePath(); c.fill(); } c.restore();
  c.fillStyle = '#5c93a0'; for (let i = 0; i < 16; i++) { const tx = ((i * 110 + hash(i, 1) * 60 - t * 6) % (W / dp + 200) + W / dp + 200) % (W / dp + 200) * dp - 100 * dp, th = (50 + hash(i, 3) * 120) * .55 * dp, tw = (26 + hash(i, 2) * 30) * .55 * dp; c.fillRect(tx, hz - th, tw, th); if (hash(i, 4) > .6) { c.beginPath(); c.moveTo(tx, hz - th); c.lineTo(tx + tw / 2, hz - th - tw * .6); c.lineTo(tx + tw, hz - th); c.fill(); } }
  const sea = c.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#3fa2ad'); sea.addColorStop(.3, '#17708a'); sea.addColorStop(1, '#0a3e54'); c.fillStyle = sea; c.fillRect(0, hz, W, H - hz);
  c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 22; i++) { const yy = hz + (4 + i * i * .9) * dp, ww = (30 - i * .6) * dp * (1 + Math.sin(t * 2 + i) * .3); c.fillStyle = `rgba(255,214,150,${.5 - i * .02})`; c.fillRect(sx - ww / 2 + Math.sin(t * 1.5 + i * 2) * 6 * dp, yy, ww, 1.6 * dp); } c.restore();
  c.fillStyle = 'rgba(200,245,240,.35)'; for (let i = 0; i < 30; i++) { const yy = hz + (8 + (i * 37) % 120) * dp, xx = ((i * 211 + t * 14) % (W / dp + 80)) * dp - 40 * dp; c.fillRect(xx, yy, (10 + (i % 4) * 8) * dp, dp); }
  const gy = H * .88; c.fillStyle = '#e6b673'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 20; x += 20) c.lineTo(x, gy - (Math.sin(x / 140 / dp) * 10 + 6) * dp); c.lineTo(W, H); c.closePath(); c.fill(); c.fillStyle = '#ffdb93'; c.fillRect(0, gy + 6 * dp, W, 4 * dp);
  const sc = 2.1 * dp, base = W * (W / dp > 900 ? .72 : .5);
  HEROES.forEach((h, i) => { const hx = base + (i - 1.5) * 60 * sc, cyc = (frame + i * 37) % 600, S = cyc > 520 && cyc < 560 ? { anim: 'win', t: frame + i * 37 } : { anim: 'idle', t: frame + i * 37 }; c.fillStyle = 'rgba(10,20,30,.25)'; c.beginPath(); c.ellipse(hx, gy + 8 * dp, 16 * sc, 4 * sc, 0, 0, TAU); c.fill(); drawHero(c, h, S, hx, gy + 8 * dp, i < 2 ? 1 : -1, sc); });
}
