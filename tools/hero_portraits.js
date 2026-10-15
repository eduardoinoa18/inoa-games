// Renders hub hero-picker portraits (thumbs/heroes/<model>.png) with the real engine + packed models.
// usage: node test/run.js drift tools/hero_portraits.js
module.exports = async (p) => {
  const MODELS = ['skater-female', 'skater-male', 'survivor-female', 'survivor-male', 'cyborg-female', 'male'];
  const out = await p.evaluate(async (MODELS) => {
    const E = await import('/engine/inoa3d.js'); const T = E.THREE; const c = document.createElement('canvas'); c.width = 320; c.height = 400;
    const r = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.setPixelRatio(1); r.setSize(320, 400, false);
    const res = {};
    for (const name of MODELS) {
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xeaf6ff, 0x6a5040, 1.4)); const sun = new T.DirectionalLight(0xfff0d6, 2.2); sun.position.set(2, 4, 5); sc.add(sun);
      const m = E.instance(name, { scale: 1.75, fit: 'height', outline: true }); const rig = E.bones(m); E.pose(rig, E.POSES.idle(0.4)); sc.add(m);
      m.updateMatrixWorld(true); const box = new T.Box3(); m.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); box.union(b); } else if (o.isMesh && !o.userData.outline) box.expandByObject(o); });
      const h = box.max.y - box.min.y, cy = box.min.y + h * .80; const cam = new T.PerspectiveCamera(30, 320 / 400, .01, 100); cam.position.set(0, cy + h * .03, h * .95); cam.lookAt(0, cy, 0);
      r.setClearColor(0, 0); r.render(sc, cam); res[name] = c.toDataURL('image/png');
    }
    return res;
  }, MODELS);
  const fs = require('fs'), path = require('path');
  for (const [k, v] of Object.entries(out)) { fs.writeFileSync(path.join(__dirname, '..', 'thumbs', 'heroes', k + '.png'), Buffer.from(v.split(',')[1], 'base64')); console.log('wrote', k); }
};
