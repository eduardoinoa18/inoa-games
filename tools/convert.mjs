import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
// usage: node tools/convert.mjs <source-dir-with-<name>/model.gltf> [out-dir=assets/models]
// Source library used: github.com/pmndrs/market-assets (files/models, CC0). Decodes Draco, strips KHR_materials_unlit, writes optimized GLB.
const src = process.argv[2] || 'market-assets/files/models', out = process.argv[3] || 'assets/models';
for (const name of fs.readdirSync(src)) {
  const f = `${src}/${name}/model.gltf`; if (!fs.existsSync(f)) continue; if (fs.existsSync(`${out}/${name}.glb`)) continue;
  try {
  const doc = await io.read(f);
  for (const m of doc.getRoot().listMaterials()) { m.setExtension('KHR_materials_unlit', null); m.setRoughnessFactor(.9); m.setMetallicFactor(0); }
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression' || e.extensionName === 'KHR_materials_unlit') e.dispose();
  await doc.transform(dedup(), weld(), prune());
  const glb = await io.writeBinary(doc); fs.writeFileSync(`${out}/${name}.glb`, glb);
  console.log(name, (glb.length / 1024).toFixed(0) + 'KB');
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 120)); }
}
