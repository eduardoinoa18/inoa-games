import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/*LOGIC_A*/
/* ================= Engine: renderer, environment, post ================= */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcfe9f5, 40, 110);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 300); camera.position.set(0, 5.2, 9.5);
const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x9a7b55, .35); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xfff0d6, 2.2); sunL.position.set(8, 16, 6); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.camera.left = -16; sunL.shadow.camera.right = 16; sunL.shadow.camera.top = 14; sunL.shadow.camera.bottom = -50; sunL.shadow.camera.near = 1; sunL.shadow.camera.far = 70; sunL.shadow.bias = -.0006; sunL.shadow.normalBias = .02; scene.add(sunL); scene.add(sunL.target);
const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .18, .4, .96); composer.addPass(bloom);
const vignette = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uAmt: { value: .28 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform sampler2D tDiffuse;uniform float uAmt;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=distance(vUv,vec2(.5));c.rgb*=1.-smoothstep(.45,.95,d)*uAmt;gl_FragColor=c;}' }); composer.addPass(vignette);
composer.addPass(new OutputPass()); const smaa = new SMAAPass(1, 1); composer.addPass(smaa);
const MAT = {}; const mat = (col, extra) => { const k = col + JSON.stringify(extra || {}); if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .85, metalness: 0 }, extra || {})); return MAT[k]; };
const LANES = [-2.6, 0, 2.6];
/* ---------- Assets ---------- */
const ASSETS = { models: {}, hdri: {} };
const MODEL_NAMES = ['ambulance', 'plant', 'low-poly-tree', 'bench', 'pumpkin', 'apple', 'banana', 'broccoli', 'carrot', 'cheese', 'egg', 'bread', 'loaf', 'cookie', 'cupcake', 'peanut-butter', 'soy', 'fish', 'carton', 'carton-small', 'bowl-cereal', 'candy-bar', 'grapes', 'bottle', 'can', 'cake-birthday', 'watermelon', 'pizza-box', 'bag', 'donut-sprinkles', 'muffin', 'sandwich', 'taco', 'strawberry', 'orange', 'pear', 'corn', 'mussel', 'sushi-salmon', 'chocolate', 'palm-detailed-short', 'palm-long', 'formation-rock', 'formation-stone', 'tree-big', 'house-3', 'pirate-crew', 'skater-female', 'skater-male', 'chest', 'barrel', 'boat-small'];
const HDRIS = ['dawn', 'sunset'];
const gltfLoader = new GLTFLoader(), rgbeLoader = new RGBELoader();
async function loadAssets(onProgress) {
  onProgress(.05);
  const res = await fetch('assets/pack.json'); const total = Number(res.headers.get('content-length')) || 7.2e6; const reader = res.body.getReader(); const chunks = []; let got = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(.05 + .6 * Math.min(1, got / total)); }
  const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer()); const pack = JSON.parse(text);
  const b64 = str => { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const names = Object.keys(pack.models), hn = Object.keys(pack.hdri); let n = 0; const tick = () => onProgress(.65 + .35 * (++n / (names.length + hn.length)));
  await Promise.all(names.map(name => new Promise(resolve => { try { gltfLoader.parse(b64(pack.models[name]), '', g => { ASSETS.models[name] = g.scene; tick(); resolve(); }, e => { console.warn('model failed', name, e); tick(); resolve(); }); } catch (e) { console.warn('model failed', name, e); tick(); resolve(); } })));
  for (const name of hn) { try { const td = rgbeLoader.parse(b64(pack.hdri[name])); const t = new THREE.DataTexture(td.data, td.width, td.height, THREE.RGBAFormat, td.type); t.flipY = true; t.colorSpace = THREE.LinearSRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true; ASSETS.hdri[name] = { tex: t, env: pmrem.fromEquirectangular(t).texture }; } catch (e) { console.warn('hdri failed', name, e); } tick(); }
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2b2420, side: THREE.BackSide });
function addOutline(root, w = 1.03) { root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.outline) { const h = new THREE.Mesh(o.geometry, OUTLINE); h.scale.setScalar(w); h.userData.outline = true; h.renderOrder = -1; o.add(h); } }); }
function instance(name, { scale = 1, shadow = true, outline = true, tint = null } = {}) {
  const src = ASSETS.models[name]; const g = new THREE.Group();
  if (!src) { const m = new THREE.Mesh(new THREE.SphereGeometry(.4, 12, 10), mat(0xffffff)); m.position.y = .4; g.add(m); return g; }
  let skinned = false; src.traverse(o => { if (o.isSkinnedMesh) skinned = true; }); const c = skinned ? skClone(src) : src.clone(true); c.traverse(o => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; if (o.isSkinnedMesh) o.frustumCulled = false; if (tint) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } } });
  // normalize: feet at y=0, size by bounding box height
  const box = new THREE.Box3().setFromObject(c); const size = box.getSize(new THREE.Vector3()); const s = scale / Math.max(size.x, size.y, size.z); c.scale.setScalar(s); c.position.y = -box.min.y * s; c.position.x = -(box.min.x + size.x / 2) * s; c.position.z = -(box.min.z + size.z / 2) * s;
  if (outline) addOutline(c); g.add(c); return g;
}
/* ---------- World: a safari trail ---------- */
let _grain = null;
function grainTex() { if (_grain) return _grain; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); const d = g.getImageData(0, 0, 256, 256); for (let i = 0; i < d.data.length; i += 4) { const n = 215 + Math.random() * 40; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; } g.putImageData(d, 0, 0); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${.04 + Math.random() * .06})`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3, Math.random() * 3, 0, 6.3); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 28); t.colorSpace = THREE.SRGBColorSpace; _grain = t; return t; }
let tuftGroups = [], weather = null;
function makeTufts(L, zBase) { const g = new THREE.Group(); const n = L.weather === 'snow' ? 220 : 520; const geo = new THREE.ConeGeometry(.09, .38, 5); const m = new THREE.InstancedMesh(geo, mat(L.grass2, { roughness: 1 }), n); const o = new THREE.Object3D(); for (let i = 0; i < n; i++) { const side = Math.random() < .5 ? -1 : 1; const x = side * (4.9 + Math.random() * (side < 0 ? 2.2 : 9)); const z = -64 + Math.random() * 128; o.position.set(x, .12, z); o.rotation.set((Math.random() - .5) * .5, Math.random() * 6.3, (Math.random() - .5) * .5); o.scale.setScalar(.7 + Math.random() * .9); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } m.castShadow = true; g.add(m);
  if (!L.night && L.weather !== 'snow') { const fn = 110; const fg = new THREE.SphereGeometry(.09, 6, 5); const fm = new THREE.InstancedMesh(fg, mat(0xffffff), fn); const cols = [new THREE.Color(0xff6b7a), new THREE.Color(0xffd166), new THREE.Color(0xffffff), new THREE.Color(0xc9b8ff)]; for (let i = 0; i < fn; i++) { const side = Math.random() < .5 ? -1 : 1; o.position.set(side * (5.2 + Math.random() * 6), .28, -64 + Math.random() * 128); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); fm.setColorAt(i, cols[i % 4]); } g.add(fm); }
  g.position.z = zBase; return g; }
function makeWeather(kind) { const n = kind === 'rain' ? 1400 : 700; const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = -42 + Math.random() * 52; } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d'); if (kind === 'rain') { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(200,225,255,0)'); gr.addColorStop(.5, 'rgba(200,225,255,.9)'); gr.addColorStop(1, 'rgba(200,225,255,0)'); g.fillStyle = gr; g.fillRect(13, 0, 6, 64); } else { const gr = g.createRadialGradient(16, 32, 0, 16, 32, 14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 64); } const t = new THREE.CanvasTexture(c); const m = new THREE.Points(geo, new THREE.PointsMaterial({ size: kind === 'rain' ? .6 : .32, map: t, transparent: true, depthWrite: false, opacity: kind === 'rain' ? .55 : .9, color: kind === 'rain' ? 0xcfe3ff : 0xffffff })); m.userData.kind = kind; m.frustumCulled = false; return m; }
function updateWeather(dt, v) { if (!weather) return; const p = weather.geometry.attributes.position; const rain = weather.userData.kind === 'rain'; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - (rain ? 16 : 1.6) * dt, x = p.getX(i), z = p.getZ(i) + v * dt * .3; if (!rain) x += Math.sin(G.t * 1.5 + i) * .4 * dt; if (y < 0) { y = 16; x = (Math.random() - .5) * 30; z = -42 + Math.random() * 52; } if (z > 10) z -= 52; p.setXYZ(i, x, y, z); } p.needsUpdate = true; weather.position.x = G.x; }
const world = new THREE.Group(); scene.add(world);
let scrollers = [], lanterns = [];
let water = null;
const WATER_SHADER = {
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x3fb6c9) }, uDeep: { value: new THREE.Color(0x1a6f8a) }, uFoam: { value: new THREE.Color(0xeafcff) } },
  vertexShader: 'uniform float uTime;varying vec2 vUv;varying float vH;void main(){vUv=uv;vec3 p=position;float h=sin(p.x*.6+uTime*1.3)*.12+sin(p.y*.9-uTime*1.7)*.1+sin((p.x+p.y)*.35+uTime*.8)*.08;p.z+=h;vH=h;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
  fragmentShader: 'uniform vec3 uColor;uniform vec3 uDeep;uniform vec3 uFoam;uniform float uTime;varying vec2 vUv;varying float vH;void main(){float k=smoothstep(-.2,.3,vH);vec3 c=mix(uDeep,uColor,k);float f=smoothstep(.22,.3,vH+sin(vUv.x*80.+uTime*2.)*.02);c=mix(c,uFoam,f*.7);float edge=smoothstep(.0,.08,vUv.x);c=mix(uFoam,c,edge);gl_FragColor=vec4(c,.92);}'
};
function buildWorld(L) {
  while (world.children.length) world.remove(world.children[0]); scrollers = []; lanterns = [];
  const H = ASSETS.hdri[L.hdri] || ASSETS.hdri.dawn; if (H) { scene.environment = H.env; scene.environmentIntensity = L.envI; } scene.background = null;
  // sky dome: gradient + sun glow + stars at night
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false, uniforms: { uTop: { value: new THREE.Color(L.skyTop) }, uHor: { value: new THREE.Color(L.skyHor) }, uSun: { value: new THREE.Color(L.skyGlow) }, uSunDir: { value: new THREE.Vector3(.35, .25, -.9).normalize() } }, vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 uTop,uHor,uSun,uSunDir;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(uHor,uTop,pow(h,.55));float d=max(0.,dot(vP,uSunDir));c+=uSun*(pow(d,90.)*.3+pow(d,10.)*.04);gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}' })); sky.renderOrder = -10; world.add(sky);
  if (L.night) { const n = 500, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * .9 + .08, r = 150; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6d8, size: 1.6, sizeAttenuation: true, transparent: true, opacity: .9, fog: false })); world.add(stars); const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false })); moon.position.set(50, 60, -120); world.add(moon); }
  else { for (let i = 0; i < 9; i++) { const cl = new THREE.Group(); const hh = hash(i, 7); for (let k = 0; k < 5; k++) { const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + hash(i, k) * 4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, fog: false, transparent: true, opacity: .92 })); puff.position.set(k * 5 - 10, hash(k, i) * 2, hash(i + 3, k) * 3); puff.scale.y = .55; cl.add(puff); } cl.position.set(-70 + i * 18 + hh * 10, 34 + hh * 14, -110 - hash(i, 9) * 30); world.add(cl); } }
  renderer.toneMappingExposure = L.exposure * .92; scene.fog.color.set(L.fog); scene.fog.near = L.night ? 24 : (L.weather ? 30 : 70); scene.fog.far = L.night ? 80 : (L.weather ? 95 : 150); sunL.intensity = L.sun * .62; sunL.color.set(L.sunColor); hemi.intensity = L.night ? .14 : .4; hemi.color.set(L.skyHor); hemi.groundColor.set(L.sand); bloom.strength = L.night ? .45 : .14; bloom.threshold = L.night ? .8 : .97;
  // ground: path + grass with vertex colors and gentle bumps
  const geo = new THREE.PlaneGeometry(40, 180, 60, 180); const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const sand = new THREE.Color(L.sand), grass = new THREE.Color(L.grass), grass2 = new THREE.Color(L.grass2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const d = Math.abs(x); const onPath = d < 4.6; const bump = onPath ? 0 : (hash(Math.round(x * 2), Math.round(y)) - .5) * .5 + Math.max(0, d - 6) * .08; pos.setZ(i, bump); const c = onPath ? sand.clone().lerp(grass, smooth(3.6, 4.6, d)) : (hash(Math.round(x), Math.round(y * 2)) > .5 ? grass : grass2); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, map: grainTex() })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -60); ground.receiveShadow = true; world.add(ground);
  // lane marks: small stones every few meters
  for (let z = 6; z > -120; z -= 4) for (const x of [-3.9, 3.9]) { const st = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 5), mat(0xd9cdb5)); st.position.set(x + (hash(z, x) - .5) * .4, .05, z); st.scale.y = .5; st.castShadow = true; world.add(st); scrollers.push(st); }
  // water on the left
  const wgeo = new THREE.PlaneGeometry(40, 200, 40, 100); water = new THREE.Mesh(wgeo, new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(WATER_SHADER.uniforms), vertexShader: WATER_SHADER.vertexShader, fragmentShader: WATER_SHADER.fragmentShader, transparent: true })); water.material.uniforms.uColor.value.set(L.water); water.material.uniforms.uDeep.value.set(L.waterDeep); water.rotation.x = -Math.PI / 2; water.position.set(-28, .12, -60); world.add(water);
  // scenery recycled along z
  const place = (name, x, z, s, ry) => { if (L.weather === 'snow' && (name.startsWith('palm') || name === 'tree-big' || name === 'plant')) { name = 'low-poly-tree'; s = Math.max(4, s * .8); } const m = instance(name, { scale: s, tint: L.weather === 'snow' && name === 'low-poly-tree' ? 0xd8e4ee : null }); m.position.set(x, 0, z); m.rotation.y = ry; world.add(m); scrollers.push(m); return m; };
  for (let z = 8; z > -120; z -= 7) {
    const h1 = hash(z, 1), h2 = hash(z, 2), h3 = hash(z, 3);
    place(h1 < .5 ? 'palm-detailed-short' : 'palm-long', 7.5 + h2 * 4, z, 5 + h3 * 2.5, h1 * 6.3);
    if (h2 > .45) place(h3 < .5 ? 'formation-rock' : 'formation-stone', 6 + h1 * 2, z - 3, 1.2 + h2, h3 * 6);
    if (h1 > .7) place(L.weather === 'snow' ? 'low-poly-tree' : 'tree-big', 12 + h3 * 5, z - 2, 6 + h1 * 3, h2 * 6); if (h2 > .6 && !L.night) place(L.weather === 'snow' ? 'low-poly-tree' : 'plant', -6.2 - h1 * 1.5, z + 2.2, L.weather === 'snow' ? 4 : 1.3, h2 * 6); if (h1 < .18) place('bench', 5.6, z - 1, 1.6, Math.PI / 2);
    if (h3 > .8) place('house-3', 15 + h1 * 4, z, 6, Math.PI * 1.1 + h2);
    place(h2 < .5 ? 'palm-detailed-short' : 'palm-long', -7 - h3 * 2.5, z - 3.5, 4.5 + h1 * 2.5, h3 * 6.3);
    if (h1 > .55) place('formation-stone', -5.6 - h2, z + 1, .9 + h3 * .8, h1 * 6);
    if (h3 > .66) place(h1 < .5 ? 'barrel' : 'chest', 5.2 + h2 * .6, z + 2, 1, h3 * 6);
    if (L.night || h2 > .82) { const post = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 2.6, 8), mat(0x5a3b1e)); pole.position.y = 1.3; post.add(pole); const lamp = new THREE.Mesh(new THREE.SphereGeometry(.26, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc25a, emissiveIntensity: L.night ? 1.9 : .25, roughness: .4 })); lamp.position.y = 2.75; post.add(lamp); if (L.night) { const pl = new THREE.PointLight(0xffb85a, 2.6, 11, 2); pl.position.y = 2.7; post.add(pl); } post.position.set(h1 > .5 ? 5.4 : -5.4, 0, z + 3); world.add(post); scrollers.push(post); lanterns.push(lamp); }
  }
  tuftGroups = [makeTufts(L, -60), makeTufts(L, -188)]; for (const tg of tuftGroups) world.add(tg);
  if (weather) { scene.remove(weather); weather = null; } if (L.weather) { weather = makeWeather(L.weather); scene.add(weather); }
  if (L.weather === 'snow') { const snowc = new THREE.Mesh(new THREE.PlaneGeometry(40, 180), mat(0xf4f8ff, { roughness: 1, transparent: true, opacity: .0 })); snowc.visible = false; world.add(snowc); }
  // boat drifting on the water
  const boat = instance('boat-small', { scale: 4 }); boat.position.set(-12, .1, -30); boat.rotation.y = .4; world.add(boat); boat.userData.boat = true; scrollers.push(boat);
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* ---------- Cart, kid, grown-up, buddy ---------- */
const cart = new THREE.Group(); scene.add(cart);
let kidRig = null, grownRig = null;
function findBones(root) { const b = {}; root.traverse(o => { if (o.isBone) b[o.name] = o; }); for (const k in b) b[k].userData.rest = b[k].quaternion.clone(); return b; }
function buildCart() {
  while (cart.children.length) cart.remove(cart.children[0]);
  const wood = mat(0xa0683a, { roughness: .8 }), wood2 = mat(0x7a4b26), iron = mat(0x3a3f47, { metalness: .4, roughness: .5 });
  const body = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2, .18, 1.9), wood2); base.position.y = .62; body.add(base);
  for (const [x, z, rx, rz] of [[-1, 0, 0, 0], [1, 0, 0, 0], [0, -.95, 0, 0], [0, .95, 0, 0]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(x ? .1 : 2.1, .7, z ? .1 : 1.9), wood); wall.position.set(x, 1.05, z); body.add(wall); for (let i = 0; i < 3; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(x ? .12 : 2.14, .14, z ? .12 : 1.94), i % 2 ? wood2 : wood); slat.position.set(x, .78 + i * .24, z); body.add(slat); } }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.1, 10), iron); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.75, 1.15); body.add(handle); for (const x of [-.9, .9]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .9, 8), iron); st.position.set(x, 1.35, 1.1); st.rotation.x = .25; body.add(st); }
  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); addOutline(body, 1.03); cart.add(body);
  for (const [x, z] of [[-1.05, -.6], [1.05, -.6], [-1.05, .6], [1.05, .6]]) { const w = new THREE.Group(); const tire = new THREE.Mesh(new THREE.TorusGeometry(.3, .12, 10, 20), mat(0x23272e)); const hub = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .12, 12), mat(0xd9a21b)); hub.rotation.z = Math.PI / 2; w.add(tire, hub); w.rotation.y = Math.PI / 2; w.position.set(x, .4, z); w.name = 'wheel'; w.traverse(o => { if (o.isMesh) o.castShadow = true; }); cart.add(w); }
  // kid: a skater model, feet on the cart floor
  const kid = instance('skater-female', { scale: 1.7, outline: false }); kid.position.set(.1, .7, .25); kid.rotation.y = Math.PI; kid.name = 'kid'; cart.add(kid); kidRig = findBones(kid);
  // grown-up pushes the cart in duo mode
  const grown = instance('skater-male', { scale: 2.15, outline: false }); grown.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(0x9fd0ff)); } }); grown.position.set(-.55, 0, 2.5); grown.rotation.y = Math.PI; grown.rotation.y = 0; grown.name = 'grown'; grown.visible = !!S.duo; cart.add(grown); grownRig = findBones(grown);
  // buddy
  const buddy = new THREE.Group(); buddy.name = 'buddy';
  const egg = new THREE.Mesh(new THREE.SphereGeometry(.36, 20, 16), mat(0xfff3dc, { roughness: .5 })); egg.scale.y = 1.25; egg.name = 'egg'; egg.castShadow = true; buddy.add(egg); for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 8), mat(0x6fd8bf)); sp.position.set(Math.cos(i * 1.3) * .27, Math.sin(i * 2.1) * .32, Math.sin(i * 1.3) * .27); egg.add(sp); }
  const crit = new THREE.Group(); crit.name = 'crit'; crit.visible = false; const skin = mat(0x8fe0c8, { roughness: .6 }); const bod = new THREE.Mesh(new THREE.SphereGeometry(.38, 20, 16), skin); bod.scale.set(1, .88, 1); crit.add(bod); const belly = new THREE.Mesh(new THREE.SphereGeometry(.27, 14, 12), mat(0xfff8ee)); belly.position.set(0, -.08, .2); belly.scale.set(1, .8, .5); crit.add(belly); for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .38, 10), skin); ear.position.set(sx * .23, .42, 0); ear.rotation.z = -sx * .35; crit.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 10), mat(0x1b2430)); eye.position.set(sx * .14, .08, .34); crit.add(eye); const shine = new THREE.Mesh(new THREE.SphereGeometry(.028, 6, 6), mat(0xffffff)); shine.position.set(sx * .16, .11, .4); crit.add(shine); const cheek = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), mat(0xff9bb0)); cheek.position.set(sx * .23, -.02, .31); crit.add(cheek); } const tail = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 10), mat(0xffd166)); tail.position.set(0, -.1, -.38); crit.add(tail); crit.traverse(o => { if (o.isMesh) o.castShadow = true; }); addOutline(crit, 1.06); buddy.add(crit);
  buddy.position.set(0, 1.25, -.35); cart.add(buddy);
}
/* Scanner beam (grown-up) */
const laneGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 60), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: .18, depthWrite: false })); laneGlow.rotation.x = -Math.PI / 2; laneGlow.position.set(0, .03, -28); scene.add(laneGlow);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, 1.8, 18, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xb49cff, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.rotation.x = Math.PI / 2; beam.position.set(0, 2.2, -10); beam.visible = false; scene.add(beam);
/* ---------- Food instances ---------- */
const FOOD_MODEL = { 'Apple': 'apple', 'Carrot': 'carrot', 'Broccoli': 'broccoli', 'Banana': 'banana', 'Rice bowl': 'bowl-cereal', 'Grapes': 'grapes', 'Water': 'bottle', 'Milk': 'carton', 'Cheese': 'cheese', 'Yogurt': 'carton-small', 'Egg': 'egg', 'Omelet': 'egg', 'Peanut butter': 'peanut-butter', 'Peanuts': 'bag', 'Almonds': 'bag', 'Cashew bar': 'candy-bar', 'Bread': 'bread', 'Pasta': 'bowl-cereal', 'Pretzel': 'loaf', 'Soy milk': 'soy', 'Tofu': 'cheese', 'Edamame': 'bag', 'Fish sticks': 'fish', 'Salmon': 'sushi-salmon', 'Shrimp': 'mussel', 'Crab cake': 'taco', 'Sesame bun': 'sandwich', 'Hummus': 'can', 'Cookie': 'cookie', 'Cupcake': 'cupcake', 'Strawberries': 'strawberry', 'Orange': 'orange', 'Pear': 'pear', 'Corn': 'corn', 'Watermelon': 'watermelon', 'Muffin': 'muffin', 'Donut': 'donut-sprinkles', 'Birthday cake': 'cake-birthday', 'Chocolate': 'chocolate' };
const PACK_MODEL = { box: 'pizza-box', bag: 'bag', bar: 'candy-bar', can: 'can', bottle: 'bottle', carton: 'carton' };
const qSprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b2430'; g.stroke(); g.fillStyle = '#1b2430'; g.font = '900 78px Unbounded, Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: t, depthTest: true }); })();
const TAGS = {};
function tagSprite(emoji, text, bg) { const k = emoji + text + bg; if (TAGS[k]) return TAGS[k]; const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, 496, 144, 40); g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b2430'; g.stroke(); g.font = '96px serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(emoji, 28, 86); g.fillStyle = '#1b2430'; g.font = '900 54px Unbounded, Manrope, sans-serif'; g.textAlign = 'left'; let f = 54; while (g.measureText(text).width > 350 && f > 28) { f -= 4; g.font = `900 ${f}px Unbounded, Manrope, sans-serif`; } g.fillText(text, 140, 86); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }); TAGS[k] = m; return m; }
function foodMesh(kind, col, name, pack, emoji) {
  const model = pack ? (PACK_MODEL[kind] || 'pizza-box') : (FOOD_MODEL[name] || 'apple');
  const g = instance(model, { scale: pack ? 1.5 : 1.4, tint: pack && col ? col : null });
  const tag = new THREE.Sprite(tagSprite(pack ? '📦' : (emoji || '🍽️'), pack ? name : name, pack ? '#ffe9a8' : '#ffffff')); tag.scale.set(4, 1.25, 1); tag.position.y = 2.3; tag.name = 'tag'; tag.renderOrder = 5; g.add(tag);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22 })); blob.rotation.x = -Math.PI / 2; blob.position.y = -.17; g.add(blob);
  if (pack) { const q = new THREE.Sprite(qSprite); q.scale.setScalar(1); q.position.y = 3.1; q.name = 'q'; g.add(q); }
  return g;
}
/* ---------- Speech (for kids who can't read yet) ---------- */
let voiceOK = 'speechSynthesis' in window;
function say(text, { interrupt = true } = {}) { if (!voiceOK || !S.voice || !text) return; try { if (interrupt) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#]/g, '')); u.lang = S.lang === 'es' ? 'es-US' : 'en-US'; u.rate = .95; u.pitch = 1.05; const vs = speechSynthesis.getVoices(); const v = vs.find(x => x.lang === u.lang) || vs.find(x => x.lang.startsWith(S.lang === 'es' ? 'es' : 'en')); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) { } }
if (voiceOK) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
/* ---------- Particles ---------- */
const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,240,180,.8)'); r.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const sparks = [];
function burst(x, y, z, color, n = 18) { const geo = new THREE.BufferGeometry(); const p = new Float32Array(n * 3), v = []; for (let i = 0; i < n; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; v.push(new THREE.Vector3(rnd(-3, 3), rnd(2, 6), rnd(-3, 3))); } geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.Points(geo, new THREE.PointsMaterial({ size: .5, map: sparkTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(m); sparks.push({ m, v, t: 0 }); }
function updateSparks(dt) { for (const s of sparks.slice()) { s.t += dt; const p = s.m.geometry.attributes.position; for (let i = 0; i < s.v.length; i++) { s.v[i].y -= 12 * dt; p.setXYZ(i, p.getX(i) + s.v[i].x * dt, p.getY(i) + s.v[i].y * dt, p.getZ(i) + s.v[i].z * dt); } p.needsUpdate = true; s.m.material.opacity = 1 - s.t / .9; if (s.t > .9) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); sparks.splice(sparks.indexOf(s), 1); } } }
/* ---------- Buddy Rescue cutscene (3D) ---------- */
const R = { ring: null, amb: null, ambLights: [], sweat: [], capSnapped: false, lastTick: 0, active: false, phase: 'none', t: 0, kidPos: new THREE.Vector3(), grownPos: new THREE.Vector3(), pen: null, phone: null, hives: [], bubble: null, dialStep: 0, holdK: 0, camA: new THREE.Vector3(), camB: new THREE.Vector3(), lying: false };
function makePen() { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .9, 16), mat(0xff8a3d, { roughness: .45 })); body.position.y = .45; g.add(body); const label = new THREE.Mesh(new THREE.CylinderGeometry(.092, .092, .3, 16), mat(0xffffff)); label.position.y = .5; g.add(label); const cap = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .16, 16), mat(0x2b6fb0, { roughness: .4 })); cap.position.y = .98; cap.name = 'cap'; g.add(cap); const tip = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .12, 16), mat(0xff5a1f)); tip.position.y = -.06; tip.name = 'tip'; g.add(tip); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); addOutline(g, 1.08); g.scale.setScalar(1.3); return g; }
function phoneScreen(step) { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#0f1a2b'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#fff'; g.font = '900 54px Unbounded, Manrope, sans-serif'; g.textAlign = 'center'; const digits = ['9', '1', '1']; g.fillText(digits.slice(0, step).join(' '), 128, 90); if (step >= 3) { g.fillStyle = '#2fbf8a'; g.font = '800 26px Manrope, sans-serif'; g.fillText('Calling 911…', 128, 140); } const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']; keys.forEach((k, i) => { const x = 44 + (i % 3) * 84, y = 200 + Math.floor(i / 3) * 76; const hot = (step === 0 && k === '9') || (step >= 1 && step < 3 && k === '1'); g.fillStyle = hot ? '#ffd166' : '#1e2d44'; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = hot ? '#1b2430' : '#fff'; g.font = '800 30px Manrope, sans-serif'; g.fillText(k, x, y + 11); }); g.fillStyle = step >= 3 ? '#ff5a5a' : '#2fbf8a'; g.beginPath(); g.arc(128, 470, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '30px serif'; g.fillText('📞', 128, 481); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function makePhone() { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(.5, 1, .06), mat(0x1b2430, { roughness: .4, metalness: .3 })); g.add(body); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.44, .9), new THREE.MeshBasicMaterial({ map: phoneScreen(0), toneMapped: false })); scr.position.z = .032; scr.name = 'screen'; g.add(scr); addOutline(g, 1.05); return g; }
function setPhoneStep(step) { if (!R.phone) return; const scr = R.phone.getObjectByName('screen'); scr.material.map.dispose(); scr.material.map = phoneScreen(step); scr.material.needsUpdate = true; }
function bubble(text, emoji) { if (R.bubble) { R.bubble.parent && R.bubble.parent.remove(R.bubble); } const sp = new THREE.Sprite(tagSprite(emoji, text, '#ffffff')); sp.material = sp.material.clone(); sp.material.fog = false; sp.scale.set(3.4, 1.06, 1); sp.renderOrder = 9; R.bubble = sp; return sp; }
function startRescue() {
  R.active = true; R.phase = 'symptoms'; R.t = 0; R.dialStep = 0; R.lying = false;
  const kid = cart.getObjectByName('kid'), grown = cart.getObjectByName('grown'); grown.visible = true;
  // move kid and grown-up into world space beside the cart
  cart.updateMatrixWorld(true); const kw = new THREE.Vector3(), gw = new THREE.Vector3(); kid.getWorldPosition(kw); grown.getWorldPosition(gw); cart.remove(kid); cart.remove(grown); scene.add(kid); scene.add(grown); kid.position.copy(kw); grown.position.copy(gw); kid.rotation.set(0, -Math.PI * .5, 0); grown.rotation.set(0, Math.PI * .5, 0);
  R.kidPos.set(G.x - 3.0, 0, 2.2); R.grownPos.set(G.x - 4.4, 0, .6); R.doneLie = false;
  // hives: red dots on the kid
  R.hives = []; for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a5a })); h.position.set((Math.random() - .5) * .5, 1.0 + Math.random() * .7, .25 + Math.random() * .1); h.scale.setScalar(0); kid.add(h); R.hives.push(h); }
  const sweat = bubble(T('kidHelp'), '😖'); sweat.position.set(0, 2.3, 0); kid.add(sweat);
  if (!R.pen) R.pen = makePen(); if (!R.phone) R.phone = makePhone(); R.pen.visible = false; R.phone.visible = false; scene.add(R.pen); scene.add(R.phone); R.capSnapped = false; R.lastTick = 0;
  if (!R.ring) { R.ring = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 40, 1, 0, .01), new THREE.MeshBasicMaterial({ color: 0x2fbf8a, side: THREE.DoubleSide, transparent: true, opacity: .95, depthTest: false })); R.ring.renderOrder = 8; scene.add(R.ring); } R.ring.visible = false;
  R.sweat = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), mat(0x7fc8ff)); s.position.set(-.25 + i * .25, 1.9, .2); kid.add(s); R.sweat.push(s); }
  if (!R.amb) { R.amb = instance('ambulance', { scale: 5.2, outline: true }); for (const [x, col] of [[-.35, 0xff2a2a], [.35, 0x2a6bff]]) { const pl = new THREE.PointLight(col, 0, 9, 2); pl.position.set(x, 2.3, -.2); R.amb.add(pl); R.ambLights.push(pl); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0 })); bulb.position.set(x, 2.3, -.2); bulb.name = 'bulb' + (x < 0 ? 'R' : 'B'); R.amb.add(bulb); } } R.amb.visible = false; scene.add(R.amb);
}
function rescueStep(step) { // called by the drill UI: 1 told adult, 2 injector hold, 3 call, 4 lie down
  if (step === 1) { R.phase = 'help'; R.t = 0; const kid = scene.getObjectByName('kid'); const b = bubble(T('gotYou'), '🧑‍🍳'); b.position.set(0, 3.0, 0); scene.getObjectByName('grown').add(b); }
  if (step === 2) { R.phase = 'pen'; R.t = 0; R.holdK = 0; R.pen.visible = true; const b = bubble(T('penTip'), '💉'); b.position.set(0, 3.0, 0); scene.getObjectByName('grown').add(b); }
  if (step === 3) { R.phase = 'call'; R.t = 0; R.pen.visible = false; R.phone.visible = true; setPhoneStep(0); const b = bubble(T('dialTip'), '📞'); b.position.set(0, 3.0, 0); scene.getObjectByName('grown').add(b); }
  if (step === 4) { R.phase = 'lie'; R.t = 0; R.phone.visible = false; R.lying = true; const b = bubble(T('lieTip'), '🛏️'); b.position.set(0, 3.0, 0); scene.getObjectByName('grown').add(b); }
}
function endRescue() {
  R.active = false; R.phase = 'none'; const kid = scene.getObjectByName('kid'), grown = scene.getObjectByName('grown'); for (const h of R.hives) kid.remove(h); R.hives = []; for (const s of R.sweat) kid.remove(s); R.sweat = []; if (R.ring) R.ring.visible = false; if (R.amb) { R.amb.visible = false; for (const l of R.ambLights) l.intensity = 0; } kid.rotation.set(0, 0, 0); if (R.bubble && R.bubble.parent) R.bubble.parent.remove(R.bubble); R.bubble = null;
  scene.remove(kid); scene.remove(grown); cart.add(kid); cart.add(grown); kid.position.set(0, .7, .25); kid.rotation.set(0, Math.PI, 0); grown.position.set(-.55, 0, 2.5); grown.rotation.set(0, Math.PI, 0); grown.visible = !!S.duo; R.pen.visible = false; R.phone.visible = false;
  for (const rig of [kidRig, grownRig]) for (const k in rig) rig[k].quaternion.copy(rig[k].userData.rest);
}
function poseKid(rig, kind, t) { const set = (n, x, y, z) => { const b = rig[n]; if (!b) return; b.quaternion.copy(b.userData.rest); if (z) b.rotateZ(z); if (x) b.rotateX(x); if (y) b.rotateY(y); };
  const sit = () => { set('LeftUpLeg', 1.4, 0, .12); set('RightUpLeg', 1.4, 0, -.12); set('LeftLeg', -1.3, 0, 0); set('RightLeg', -1.3, 0, 0); };
  if (kind === 'sick') { const w = Math.sin(t * 7) * .08; sit(); set('Spine', .35 + w, 0, w); set('Head', .4, w * 2, 0); set('LeftArm', -.9, 0, -1.2); set('RightArm', -.9, 0, 1.2); set('LeftForeArm', -1.6, 0, 0); set('RightForeArm', -1.6, 0, 0); }
  if (kind === 'arms-up') { sit(); set('LeftArm', 0, 0, 1.3 + Math.sin(t * 6) * .15); set('RightArm', 0, 0, -1.3 - Math.sin(t * 6) * .15); set('Head', -.25, 0, 0); }
  if (kind === 'sit') { sit(); set('Spine', .12, 0, 0); set('LeftArm', -.2, 0, -1.25); set('RightArm', -.2, 0, 1.25); set('LeftForeArm', -.3, 0, 0); set('RightForeArm', -.3, 0, 0); set('Head', .05, Math.sin(t) * .2, 0); }
  if (kind === 'lie') { set('LeftUpLeg', 0, 0, 1.15); set('RightUpLeg', 0, 0, 1.15); set('LeftLeg', -.3, 0, 0); set('RightLeg', -.3, 0, 0); set('LeftArm', -.1, 0, -1.3); set('RightArm', -.1, 0, 1.3); set('Head', .15, 0, 0); }
  if (kind === 'kneel') { const br = Math.sin(t * 2) * .03; set('LeftUpLeg', 1.5, 0, .05); set('LeftLeg', -2.3, 0, 0); set('RightUpLeg', .1, 0, -.05); set('RightLeg', -2.2, 0, 0); set('Spine', .4 + br, 0, 0); set('LeftArm', -1.0, 0, -1.0); set('RightArm', -1.3 + br, 0, 1.0); set('RightForeArm', -1.1, 0, 0); set('LeftForeArm', -.9, 0, 0); set('Head', .25, 0, 0); }
}
const faceTo = (obj, target) => { obj.rotation.y = Math.atan2(target.x - obj.position.x, target.z - obj.position.z); };
function thighWorld(rig) { const b = rig && rig.LeftUpLeg; const v = new THREE.Vector3(); if (!b) return v.copy(R.kidPos).add(new THREE.Vector3(0, .5, 0)); b.updateWorldMatrix(true, false); b.getWorldPosition(v); return v; }
function rescueUpdate(dt) {
  R.t += dt; const kid = scene.getObjectByName('kid'), grown = scene.getObjectByName('grown'); if (!kid || !grown) return;
  const k = 1 - Math.pow(.02, dt); const SIT_Y = -.62;
  if (R.phase === 'symptoms' || R.phase === 'help') for (let i = 0; i < R.sweat.length; i++) { const s = R.sweat[i]; const ph = (R.t * .9 + i * .33) % 1; s.position.y = 1.95 - ph * .6; s.position.x = -.25 + i * .25 + ph * .1; s.visible = ph < .8; }
  if (R.phase === 'symptoms') { for (let i = 0; i < R.hives.length; i++) R.hives[i].scale.setScalar(clamp((R.t - i * .25) * 1.5, 0, 1)); poseKid(kidRig, 'sick', R.t); kid.position.lerp(new THREE.Vector3(R.kidPos.x, SIT_Y, R.kidPos.z), k); kid.rotation.y = lerp(kid.rotation.y, .35, k);
    grown.position.lerp(new THREE.Vector3(G.x - 1.2, 0, 2.6), k * .6); faceTo(grown, new THREE.Vector3(G.x - 1.2, 0, 2.6)); grown.rotation.y = Math.PI * .5; animateRig(grownRig, R.t, 5, 0, 'walk'); }
  if (R.phase === 'help') { poseKid(kidRig, R.t < 1.6 ? 'arms-up' : 'sit', R.t); kid.position.lerp(new THREE.Vector3(R.kidPos.x, SIT_Y, R.kidPos.z), k); grown.position.lerp(R.grownPos, k * .8); faceTo(grown, grown.position.distanceTo(R.grownPos) > .3 ? R.grownPos : R.kidPos); if (grown.position.distanceTo(R.grownPos) > .3) animateRig(grownRig, R.t, 8, 0, 'walk'); else poseKid(grownRig, 'kneel', R.t); kid.rotation.y = lerp(kid.rotation.y, .35, k); }
  if (R.phase === 'pen') { poseKid(kidRig, 'sit', R.t); poseKid(grownRig, 'kneel', R.t); kid.position.y = SIT_Y;
    const cap = R.pen.getObjectByName('cap'); const capOff = clamp((R.t - .4) / .6, 0, 1); cap.position.set(-capOff * .5, .98 + capOff * .9 - capOff * capOff * .6, 0); cap.rotation.z = -capOff * 2.5; cap.visible = capOff < 1 || R.t < 1.2;
    const thigh = thighWorld(kidRig).add(new THREE.Vector3(-.3, -.05, .25)); const travel = clamp((R.t - 1.0) / .8, 0, 1); const start = new THREE.Vector3(R.grownPos.x + .6, 1.6, R.grownPos.z + .9); const target = thigh.clone().add(new THREE.Vector3(0, .5, 0)); R.pen.position.lerpVectors(start, target, travel); R.pen.rotation.set(0, 0, lerp(.6, 0, travel));
    if (capOff >= 1 && !R.capSnapped) { R.capSnapped = true; SFX.snap(); }
    R.ring.visible = travel >= 1; if (R.ring.visible) { const press = R.holdK; R.ring.position.copy(thigh).add(new THREE.Vector3(0, .9, .2)); R.ring.lookAt(camera.position); R.ring.geometry.dispose(); R.ring.geometry = new THREE.RingGeometry(.5, .62, 40, 1, Math.PI / 2, Math.max(.01, press * Math.PI * 2)); R.ring.material.color.set(press >= 1 ? 0xffd166 : 0x2fbf8a); const sec = Math.floor(press * 3); if (press > 0 && sec !== R.lastTick) { R.lastTick = sec; SFX.tick(); } R.pen.position.y = target.y - press * .12; R.pen.rotation.x = Math.sin(R.t * 40) * .02 * press; } }
  if (R.phase === 'call') { poseKid(kidRig, 'sit', R.t); poseKid(grownRig, 'kneel', R.t); kid.position.y = SIT_Y; R.ring.visible = false; const hand = grownRig && grownRig.RightHand; if (hand) { hand.updateWorldMatrix(true, false); hand.getWorldPosition(R.phone.position); R.phone.position.y += .9; R.phone.position.z += .5; R.phone.position.x -= .2; } else R.phone.position.set(R.grownPos.x - 1.2, 2.6, R.grownPos.z + 1.0); R.phone.rotation.y = .35; R.phone.scale.setScalar(1.25); }
  if (R.phase === 'lie') { for (const h of R.hives) h.scale.setScalar(Math.max(0, 1 - R.t * .25)); for (const s of R.sweat) s.visible = false; if (R.amb) { R.amb.visible = true; const k2 = clamp(R.t / 4.5, 0, 1), ease = 1 - Math.pow(1 - k2, 3); R.amb.position.set(G.x + 2.6, 0, lerp(-70, -7, ease)); R.amb.rotation.y = 0; const on = Math.floor(R.t * 4) % 2; R.ambLights[0].intensity = on ? 6 : 0; R.ambLights[1].intensity = on ? 0 : 6; R.amb.getObjectByName('bulbR').material.emissiveIntensity = on ? 4 : .2; R.amb.getObjectByName('bulbB').material.emissiveIntensity = on ? .2 : 4; if (k2 >= 1 && !R.doneLie) { R.doneLie = true; const b = bubble(T('helpHere'), '🚑'); b.position.set(0, 3.6, 0); R.amb.add(b); } if (R.t < 4.5 && Math.floor(R.t * 2.5) !== R.lastTick) { R.lastTick = Math.floor(R.t * 2.5); SFX.siren(); } } poseKid(kidRig, 'lie', R.t); kid.rotation.y = lerp(kid.rotation.y, 0, k); kid.rotation.z = lerp(kid.rotation.z, Math.PI / 2, k); kid.position.y = lerp(kid.position.y, .32, k); kid.position.x = lerp(kid.position.x, R.kidPos.x + .4, k); kid.position.z = lerp(kid.position.z, R.kidPos.z + .6, k); poseKid(grownRig, 'kneel', R.t); }
  if (R.bubble) R.bubble.material.opacity = .92 + Math.sin(R.t * 3) * .08;
}
function rescueCamera(dt) { const kk = 1 - Math.pow(.03, dt || .016); const portrait = innerHeight > innerWidth; const target = new THREE.Vector3(G.x - 3.4, 1.0, 1.4); const pos = portrait ? new THREE.Vector3(G.x - 3.0, 5.6, 10.5) : new THREE.Vector3(G.x - 2.4, 3.2, 9.0); camera.position.lerp(pos, kk); const look = camera.userData.look || (camera.userData.look = target.clone()); look.lerp(target, kk); camera.lookAt(look); }
/*LOGIC_B*/
/* ================= Update / render ================= */
let last = performance.now(), camSway = 0, wheelSpin = 0;
function animateRig(rig, t, speed, lean, mode) {
  if (!rig) return; const set = (name, x, y, z) => { const b = rig[name]; if (!b) return; b.quaternion.copy(b.userData.rest); if (z) b.rotateZ(z); if (x) b.rotateX(x); if (y) b.rotateY(y); };
  const ph = t * speed;
  if (mode === 'ride') { // sitting in the cart, hands on the rail, looking around; cheers on a good catch
    const ch = clamp(G.cheer || 0, 0, 1); set('LeftUpLeg', 1.35, 0, .1); set('RightUpLeg', 1.35, 0, -.1); set('LeftLeg', -1.2, 0, 0); set('RightLeg', -1.2, 0, 0);
    set('LeftArm', -.7 + Math.sin(ph * .5) * .05, 0, -1.0); set('RightArm', lerp(-.7 - Math.sin(ph * .5) * .05, .2, ch), 0, lerp(1.0, -1.1, ch)); set('LeftForeArm', -.5, 0, 0); set('RightForeArm', -.5, 0, 0);
    set('Spine', .1 + Math.abs(Math.sin(ph)) * .03, 0, lean * .4); set('Head', -.05 + Math.sin(t * 1.3) * .06, lean * 1.2 + Math.sin(t * .7) * .25, 0);
  } else { // walking behind the cart, hands on the handle
    const sw = .55; set('LeftUpLeg', Math.sin(ph) * sw, 0, 0); set('RightUpLeg', -Math.sin(ph) * sw, 0, 0); set('LeftLeg', -Math.max(0, -Math.sin(ph)) * .9, 0, 0); set('RightLeg', -Math.max(0, Math.sin(ph)) * .9, 0, 0);
    set('LeftArm', -.9, 0, -1.1); set('RightArm', G.scan ? .3 : -.9, 0, G.scan ? -.9 : 1.1); set('LeftForeArm', -.6, 0, 0); set('RightForeArm', G.scan ? 0 : -.6, 0, 0);
    set('Spine', .2 + Math.abs(Math.sin(ph * 2)) * .04, 0, lean * .3); set('Head', -.15, lean * .8, 0); if (rig.Hips) rig.Hips.position.y = (rig.Hips.userData.y0 ?? (rig.Hips.userData.y0 = rig.Hips.position.y)) + Math.abs(Math.sin(ph)) * .05;
  }
}
function update(dt) {
  if (R.active) { rescueUpdate(dt); if (water) water.material.uniforms.uTime.value += dt; return; }
  if (G.scene !== 'play' || G.paused) return;
  const L = LEVELS[G.level]; G.t += dt;
  G.x = lerp(G.x, LANES[G.lane], 1 - Math.pow(.0005, dt)); const lean = (LANES[G.lane] - G.x); G.cheer = Math.max(0, (G.cheer || 0) - dt * 1.6); G.chomp = Math.max(0, (G.chomp || 0) - dt * 2.5); cart.position.x = G.x; cart.rotation.z = lean * .1; cart.rotation.y = lean * -.09; cart.position.y = Math.abs(Math.sin(G.t * 14)) * .025 + (G.chomp || 0) * .08;
  const v = G.speed * (1 + Math.min(.6, G.t / 90)); wheelSpin += v * dt / .3; cart.traverse(o => { if (o.name === 'wheel') o.rotation.x = -wheelSpin; });
  animateRig(kidRig, G.t, 9, lean, 'ride'); animateRig(grownRig, G.t, 7.5, lean, 'walk');
  const bd = cart.getObjectByName('buddy'); if (bd) { const hatched = G.got >= 4; bd.getObjectByName('egg').visible = !hatched; bd.getObjectByName('crit').visible = hatched; const sc = hatched ? .8 + Math.min(1.2, buddyLevel() * .18) : 1; const chomp = G.chomp || 0; bd.scale.set(sc * (1 + chomp * .18), sc * (1 - chomp * .12), sc * (1 + chomp * .18)); bd.position.y = 1.25 + Math.abs(Math.sin(G.t * 6)) * (hatched ? .14 : .03); bd.rotation.z = Math.sin(G.t * 4) * .08 * (G.mood + .3); bd.rotation.y = hatched ? Math.sin(G.t * 1.5) * .3 : G.t * .8; }
  for (const g of scrollers) { g.position.z += v * dt * (g.userData.boat ? .6 : 1); if (g.position.z > 14) g.position.z -= 128; } for (const tg of tuftGroups) { tg.position.z += v * dt; if (tg.position.z > 68) tg.position.z -= 256; } updateWeather(dt, v);
  if (water) water.material.uniforms.uTime.value = G.t;
  for (const l of lanterns) l.material.emissiveIntensity = (L.night ? 1.8 : .25) + Math.sin(G.t * 6 + l.position.z) * .15;
  G.spawnT -= dt; if (G.spawnT <= 0) { spawn(); if (Math.random() < .35) spawn(); G.spawnT = rnd(.9, 1.5) * (7 / v) * 1.6; }
  if (G.offersDone < L.offers && G.t > G.nextOfferAt) { G.offersDone++; G.nextOfferAt = G.t + 14; startOffer(); return; }
  for (const it of G.items.slice()) {
    it.z += v * dt; it.mesh.position.z = it.z; it.mesh.rotation.y += it.spin * dt; it.mesh.position.y = .35 + Math.sin(G.t * 3 + it.lane) * .06; const tg = it.mesh.getObjectByName('tag'); if (tg) { tg.material.opacity = clamp((it.z + 55) / 20, 0, 1); tg.scale.set(4, 1.25, 1).multiplyScalar(it.lane === G.lane ? 1.15 : .95); }
    if (G.scan && it.kind === 'pack' && !it.scanned && it.z > -30 && it.z < -4) { it.scanned = true; SFX.scan(); const a = it.label.unsafe; const ring = new THREE.Mesh(new THREE.RingGeometry(.75, .95, 28), new THREE.MeshBasicMaterial({ color: a ? 0xff6b6b : 0x2fbf8a, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -.15; it.mesh.add(ring); }
    if (!it.taken && it.z > -1.2 && it.z < 1.2 && it.lane === G.lane) {
      it.taken = true;
      if (it.kind === 'pack') { if (!it.read) { if (it.unsafe) { G.combo = 0; hurt(T('noRead')); G.learned.add(T('alwaysRead')); burst(G.x, 1.4, 0, 0xff6b6b); } else { G.score += 5; tip(T('lucky'), 2000); burst(G.x, 1.4, 0, 0xffd166, 8); } } }
      else if (it.unsafe) { G.combo = 0; hurt(`${it.name} has ${it.al.filter(a => S.allergens.includes(a)).map(a => AL[a].name.toLowerCase()).join(' and ')} in it.`); G.learned.add(`${it.name} contains ${it.al.filter(a => S.allergens.includes(a)).map(a => AL[a].name.toLowerCase()).join(', ')}`); burst(G.x, 1.4, 0, 0xff6b6b); }
      else { G.got++; G.combo++; const bonus = Math.min(5, G.combo) * 2; G.score += 10 + bonus; floatText(`+${10 + bonus} ${it.name}`); SFX.good(); G.mood = Math.min(1, G.mood + .08); burst(G.x, 1.4, 0, 0xffe9a8); G.cheer = 1; G.chomp = 1; if (G.combo % 3 === 1) say(it.name, { interrupt: false }); }
      hud(); removeItem(it); if (G.got >= L.goal) { endLevel(true); return; } if (G.got >= G.nextMystery) { G.nextMystery += 10; mystery(); return; } continue;
    }
    if (it.z > 2.5) { if (!it.taken) { if (it.unsafe && it.kind === 'food') { G.dodged++; G.score += 3; } if (it.kind === 'pack' && !it.read && it.unsafe) G.dodged++; } removeItem(it); }
  }
  $('btnRead').classList.toggle('ready', !!nearestPack());
  beam.visible = G.scan; if (G.scan) { beam.position.x = G.x; beam.material.opacity = .13 + Math.sin(G.t * 10) * .05; } laneGlow.position.x = lerp(laneGlow.position.x, LANES[G.lane], .2); laneGlow.material.opacity = .14 + Math.sin(G.t * 5) * .05;
}
function render(dt) {
  if (window.__camLock) return;
  if (R.active) { rescueCamera(dt); return; }
  camera.userData.look = null; camSway = S.motion ? Math.sin(G.t * 1.1) * .14 : 0; G.shake = Math.max(0, G.shake - dt * 2.2); const sh = G.shake * .25;
  const portrait = innerHeight > innerWidth; camera.position.set(G.x * .35 + camSway + rnd(-sh, sh), (portrait ? 6.2 : 5.2) + rnd(-sh, sh), portrait ? 11 : 9.5); camera.lookAt(G.x * .5, 1.3, -9);
  sunL.position.set(G.x + 8, 16, 6); sunL.target.position.set(G.x, 0, -8); sunL.target.updateMatrixWorld();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.fov = w < h ? 62 : 50; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let fpsAcc = 0, fpsN = 0, lowPerf = false;
function loop(now) { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); drillTick(); updateSparks(dt); render(dt); if (G.scene === 'title' || G.scene === 'menu') { G.t += dt; for (const g of scrollers) { g.position.z += 2.5 * dt; if (g.position.z > 14) g.position.z -= 128; } for (const tg of tuftGroups) { tg.position.z += 2.5 * dt; if (tg.position.z > 68) tg.position.z -= 256; } updateWeather(dt, 2.5); if (water) water.material.uniforms.uTime.value = G.t; animateRig(kidRig, G.t, 3, 0, 'ride'); } fpsAcc += dt; fpsN++; if (fpsAcc > 3) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 40 && !lowPerf) { lowPerf = true; renderer.setPixelRatio(Math.min(DPR, 1.25)); resize(); bloom.enabled = false; } } composer.render(); }
/*LOGIC_C*/
/* boot */
(async () => {
  const bar = $('ldBar'), txt = $('ldTxt'), eggs = ['🥚', '🐣', '🍎', '🥦', '🧃'];
  await loadAssets(p => { bar.style.width = Math.round(p * 100) + '%'; $('ldE').textContent = eggs[Math.min(eggs.length - 1, Math.floor(p * eggs.length))]; txt.textContent = p < .5 ? 'Packing the cart…' : p < .9 ? 'Waking up the buddy…' : 'Ready!'; });
  buildWorld(LEVELS[0]); buildCart(); applyLang(); goTitle(); $('loading').hidden = true; requestAnimationFrame(loop);
})();
window.__AA = { G, S, startLevel, spawn, answerLabel, LEVELS, endLevel, move, tryRead, openLabel, nearestPack, ASSETS, buildCart, update, say, rig: () => kidRig, grig: () => grownRig, THREE, scene, camera, R };
</script>
