import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
// usage: R=0.2 node tools/slim.mjs <model names...>  (meshoptimizer simplification of heavy GLBs in assets/models)
const dir = 'assets/models';
for (const f of process.argv.slice(2)) {
  const p = `${dir}/${f}.glb`; const doc = await io.read(p);
  const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, pr) => b + (pr.getIndices() ? pr.getIndices().getCount() / 3 : 0), 0), 0);
  const tex = doc.getRoot().listTextures().map(t => (t.getImage()?.byteLength || 0) / 1024 | 0);
  const before = fs.statSync(p).size;
  await doc.transform(weld({ tolerance: 0.0005 }), simplify({ simplifier: MeshoptSimplifier, ratio: Number(process.env.R || .2), error: 0.01 }), dedup(), prune());
  const glb = await io.writeBinary(doc); fs.writeFileSync(p, glb);
  console.log(f, 'tris', tris | 0, 'tex KB', tex.join('/'), (before / 1024 | 0) + 'KB ->', (glb.length / 1024 | 0) + 'KB');
}
