// Cleans character textures that don't fit an all-ages hub, in the source GLBs (assets/models), before packs are built.
// survivor-female / survivor-male (Kenney): grey-brown dirt splotches and dark torn patches are painted over with the
// surrounding colour, and survivor-female's deep-red skin becomes a warm brown. Run from repo root:
//   node tools/clean_textures.mjs && python3 tools/build_pack.py ... && node tools/build_packs.mjs
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const JOBS = { 'survivor-female': { skin: true }, 'survivor-male': { skin: false } };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [name, opt] of Object.entries(JOBS)) {
  const file = `assets/models/${name}.glb`; const doc = await io.read(file); let n = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, a = data, N = W * H;
    if (opt.skin) for (let i = 0; i < N; i++) { const r = a[i * 4], g = a[i * 4 + 1], b = a[i * 4 + 2]; if (r > 60 && g < r * .45 && b < r * .45) { const k = r / 138; a[i * 4] = Math.min(255, 158 * k); a[i * 4 + 1] = Math.min(255, 104 * k); a[i * 4 + 2] = Math.min(255, 74 * k); } }
    // Kenney textures are flat colour blocks; stains are small blobs of a different colour. Label blobs of near-equal colour,
    // then repaint small, dirt-coloured (grey-brown / near-black) blobs outside the face block with the commonest colour on their rim.
    const lab = new Int32Array(N).fill(-1), same = (i, j) => Math.abs(a[i * 4] - a[j * 4]) + Math.abs(a[i * 4 + 1] - a[j * 4 + 1]) + Math.abs(a[i * 4 + 2] - a[j * 4 + 2]) < 40;
    const stack = new Int32Array(N); let comp = 0;
    for (let s0 = 0; s0 < N; s0++) { if (lab[s0] >= 0) continue; let sp = 0, cnt = 0; const px = []; stack[sp++] = s0; lab[s0] = comp;
      while (sp) { const i = stack[--sp]; px.push(i); cnt++; const x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && lab[j] < 0 && same(s0, j)) { lab[j] = comp; stack[sp++] = j; } }
      const r = a[s0 * 4], g = a[s0 * 4 + 1], b = a[s0 * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), fx = (s0 % W) / W, fy = ((s0 / W) | 0) / H;
      const dirty = (mx < 150 && (mx - mn) < Math.max(18, mx * .3) && r >= b - 6) || mx < 45;
      if (cnt < N * .006 && dirty && !(fx < .66 && fy < .48)) {
        const rim = new Map(); for (const i of px) { const x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && lab[j] !== comp && lab[j] >= 0) { const k = (a[j * 4] << 16) | (a[j * 4 + 1] << 8) | a[j * 4 + 2]; rim.set(k, (rim.get(k) || 0) + 1); } }
        let best = -1, bc = 0; for (const [k, c] of rim) if (c > bc) { bc = c; best = k; }
        if (best >= 0) for (const i of px) { a[i * 4] = best >> 16; a[i * 4 + 1] = (best >> 8) & 255; a[i * 4 + 2] = best & 255; }
      }
      comp++; }
    tex.setImage(new Uint8Array(await sharp(a, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())); n++;
  }
  if (process.env.DRY) { fs.writeFileSync(`${process.env.DRY}/${name}.png`, Buffer.from(doc.getRoot().listTextures()[0].getImage())); console.log('preview', name); continue; }
  await io.write(file, doc); console.log('cleaned', name, n, 'texture(s)');
}
