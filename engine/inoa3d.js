// Inoa Games shared 3D engine (Three.js r170). Every game on the shelf imports this file.
// Renderer + post (bloom, SMAA, vignette), sky dome, HDRI fill, packed GLB assets, toon outlines,
// sprites/labels, particles, synth audio + music, speech, input (keys, touch, swipe, gamepad),
// auto quality, shared player profile (XP/coins/hero level across every game).
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
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export { THREE };

/* ---------------- math ---------------- */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.pow(k, dt)); // k = fraction remaining after 1s
export const hash = (x, y = 0) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const $ = id => document.getElementById(id);

/* ---------------- storage + shared profile ---------------- */
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
const PROFILE_KEY = 'inoa.profile';
// Profile v2 (localStorage 'inoa.profile'): older saves are upgraded in place, never reset.
// { v, name, xp, coins, games: {id: {plays, best, last, newBest}}, recent: [ids], lang, voice, sound, music, motion, quality, hero }
const PDEF = { v: 2, name: '', xp: 0, coins: 0, games: {}, recent: [], lang: 'en', voice: true, sound: true, music: true, motion: 'auto', quality: 'auto', hero: null };
export function profile() {
  const raw = store.get(PROFILE_KEY, {}); const p = Object.assign({}, PDEF, raw && typeof raw === 'object' ? raw : {});
  p.xp = Number.isFinite(+p.xp) ? Math.max(0, +p.xp) : 0; p.coins = Number.isFinite(+p.coins) ? Math.max(0, +p.coins) : 0;
  if (!p.games || typeof p.games !== 'object') p.games = {}; if (!Array.isArray(p.recent)) p.recent = []; if (p.lang !== 'es') p.lang = 'en'; p.v = 2; return p;
}
export function heroLevel(xp) { let lv = 1, need = 100, x = xp; while (x >= need && lv < 50) { x -= need; lv++; need = Math.round(need * 1.12); } return { lv, into: x, need }; }
// Called by a game at the end of a round. Returns {xp, coins, levelUp, level}.
// A second results() for the same game within 3 s (double click, double callback) does not pay out twice.
let _lastReward = null;
export function reward(gameId, { xp = 0, coins = 0, best = null, bestLower = false } = {}) {
  const now = Date.now(); if (_lastReward && _lastReward.gameId === gameId && now - _lastReward.t < 3000) return _lastReward.r;
  const p = profile(); const before = heroLevel(p.xp).lv; xp = Math.max(0, Math.min(5000, +xp || 0)); coins = Math.max(0, Math.min(5000, +coins || 0)); p.xp += Math.round(xp); p.coins += Math.round(coins);
  const g = p.games[gameId] || { plays: 0, best: null }; g.plays = (g.plays || 0) + 1; g.last = now; if (best != null && Number.isFinite(+best) && (g.best == null || (bestLower ? best < g.best : best > g.best))) { g.best = best; g.newBest = true; } else g.newBest = false; p.games[gameId] = g;
  p.recent = [gameId, ...p.recent.filter(x => x !== gameId)].slice(0, 8); store.set(PROFILE_KEY, p);
  const after = heroLevel(p.xp); const r = { xp: Math.round(xp), coins: Math.round(coins), levelUp: after.lv > before, level: after.lv, best: g.best, newBest: g.newBest }; _lastReward = { gameId, t: now, r }; return r;
}
export function setProfile(patch) { store.set(PROFILE_KEY, Object.assign(profile(), patch)); }
// Shared settings (live in the profile so every game and the hub agree). Changing one fires 'inoa:settings' on window.
export function settings() { const p = profile(); return { sound: p.sound, music: p.music, voice: p.voice, lang: p.lang, motion: p.motion, quality: p.quality }; }
export function setSetting(k, v) { setProfile({ [k]: v }); applySettings(); dispatchEvent(new CustomEvent('inoa:settings', { detail: { key: k, value: v, settings: settings() } })); }
export const lang = () => profile().lang;
export const reducedMotion = () => { const m = profile().motion; return m === 'reduced' || (m === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); };
// Pick the string for the current language: L({en: 'Hi', es: 'Hola'}) or L('Hi', 'Hola').
export const L = (en, es) => (typeof en === 'object' && en) ? (en[lang()] ?? en.en) : (lang() === 'es' && es != null ? es : en);
function applySettings() { try { document.documentElement.classList.toggle('ig-reduced', reducedMotion()); document.documentElement.lang = lang(); _quality = profile().quality; if (musicGain) musicGain.gain.value = profile().music ? .22 : 0; } catch (e) { } }
/* engine UI strings */
const STR = {
  en: { paused: 'Paused', hub: 'Hub', restart: 'Restart', resume: 'Resume', sound: 'Sound', voice: 'Read aloud', on: 'on', off: 'off', settings: 'Settings', newBest: 'NEW BEST', roundOver: 'ROUND OVER', again: 'Play again', share: 'Share', heroLv: 'Hero lv', best: 'Best', play: 'Play', loading: 'Loading…', copied: 'Copied! Paste it anywhere.', install: 'Install Inoa Games (plays offline)', music: 'Music', language: 'Language', motion: 'Reduced motion', quality: 'Graphics', auto: 'Auto', high: 'High', low: 'Low', done: 'Done', back: 'Back to Inoa Games' },
  es: { paused: 'En pausa', hub: 'Inicio', restart: 'Reiniciar', resume: 'Seguir', sound: 'Sonido', voice: 'Leer en voz alta', on: 'sí', off: 'no', settings: 'Ajustes', newBest: 'NUEVO RÉCORD', roundOver: 'FIN DE LA RONDA', again: 'Otra vez', share: 'Compartir', heroLv: 'Nivel', best: 'Récord', play: 'Jugar', loading: 'Cargando…', copied: '¡Copiado! Pégalo donde quieras.', install: 'Instalar Inoa Games (funciona sin conexión)', music: 'Música', language: 'Idioma', motion: 'Menos movimiento', quality: 'Gráficos', auto: 'Auto', high: 'Alta', low: 'Baja', done: 'Listo', back: 'Volver a Inoa Games' }
};
export const t = k => (STR[lang()] || STR.en)[k] ?? STR.en[k] ?? k;
export function addStrings(table) { for (const l in table) Object.assign(STR[l] ||= {}, table[l]); }

/* ---------------- renderer ---------------- */
export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  _quality = profile().quality; const Q = _quality; // 'auto' | 'high' | 'low' (shared setting)
  const DPR = Math.min(devicePixelRatio || 1, Q === 'low' ? 1 : (opts.maxDpr || 2));
  renderer.setPixelRatio(DPR); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = opts.shadows !== false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcfe9f5, 60, 160);
  const camera = new THREE.PerspectiveCamera(opts.fov || 50, 1, .1, opts.far || 400);
  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x9a7b55, .4); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.5); sun.position.set(8, 16, 6); sun.castShadow = renderer.shadowMap.enabled; const ss = opts.shadowSize || 20; sun.shadow.mapSize.set(Q === 'low' ? 1024 : 2048, Q === 'low' ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -ss, right: ss, top: ss, bottom: -ss, near: 1, far: 90 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .15, .4, .95); composer.addPass(bloom);
  const vignette = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uAmt: { value: .25 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform sampler2D tDiffuse;uniform float uAmt;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=distance(vUv,vec2(.5));c.rgb*=1.-smoothstep(.45,.95,d)*uAmt;gl_FragColor=c;}' });
  composer.addPass(vignette); composer.addPass(new OutputPass()); const smaa = new SMAAPass(1, 1); composer.addPass(smaa);
  let low = Q === 'low', fpsAcc = 0, fpsN = 0; if (low) bloom.enabled = false;
  // Render on demand: opts.onDemand (or R.setOnDemand(true)) renders only after R.invalidate(); window.__NORENDER skips rendering (headless tests).
  let onDemand = !!opts.onDemand, dirty = true; const invalidate = () => { dirty = true; };
  // Distance-scaled fog: setLook({fogScale: true, fogNear: .8, fogFar: 4}) makes near/far multiples of the camera → R.focus distance.
  const focus = new THREE.Vector3(); let fogK = null;
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; if (opts.portraitFov) camera.fov = w < h ? opts.portraitFov : (opts.fov || 50); camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function render(dt) {
    if (fogK) { const d = Math.max(1, camera.position.distanceTo(focus)); scene.fog.near = d * fogK[0]; scene.fog.far = d * fogK[1]; }
    if (window.__NORENDER || (onDemand && !dirty)) return; dirty = false;
    fpsAcc += dt; fpsN++; if (fpsAcc > 3) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 40 && !low && Q !== 'high') { low = true; renderer.setPixelRatio(Math.min(DPR, 1.25)); bloom.enabled = false; resize(); } }
    composer.render();
  }
  // Look presets: sky, fog, light balance. Keeps the house style consistent across games.
  let sky = null;
  function setLook(L) {
    renderer.toneMappingExposure = L.exposure ?? .95; scene.fog.color.set(L.fog ?? 0xcfe9f5); fogK = L.fogScale ? [L.fogNear ?? .8, L.fogFar ?? 4] : null; if (!fogK) { scene.fog.near = L.fogNear ?? 60; scene.fog.far = L.fogFar ?? 160; } invalidate();
    sun.intensity = L.sun ?? 1.5; sun.color.set(L.sunColor ?? 0xfff0d6); hemi.intensity = L.hemi ?? .4; hemi.color.set(L.skyHor ?? 0xcfe9f5); hemi.groundColor.set(L.ground ?? 0x9a7b55);
    bloom.strength = L.bloom ?? .14; bloom.threshold = L.bloomThreshold ?? .96; scene.environmentIntensity = L.env ?? .15;
    if (sky) scene.remove(sky); sky = null; scene.background = null;
    if (L.background != null) scene.background = new THREE.Color(L.background);
    else { sky = skyDome(L); scene.add(sky); }
  }
  function setEnv(tex) { if (tex) scene.environment = tex; }
  addEventListener('resize', invalidate);
  return { renderer, scene, camera, hemi, sun, composer, bloom, vignette, pmrem, resize, render, setLook, setEnv, focus, invalidate, setOnDemand(v) { onDemand = !!v; dirty = true; }, get low() { return low; } };
}
export function skyDome(L) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false, uniforms: { uTop: { value: new THREE.Color(L.skyTop ?? 0x2f7fd0) }, uHor: { value: new THREE.Color(L.skyHor ?? 0xcfe9f5) }, uSun: { value: new THREE.Color(L.skyGlow ?? 0xfff0c0) }, uSunDir: { value: new THREE.Vector3(...(L.sunDir || [.35, .25, -.9])).normalize() } }, vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 uTop,uHor,uSun,uSunDir;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(uHor,uTop,pow(h,.55));float d=max(0.,dot(vP,uSunDir));c+=uSun*(pow(d,90.)*.3+pow(d,10.)*.04);gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}' });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat); dome.renderOrder = -10; g.add(dome);
  if (L.stars) { const n = 600, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * .9 + .08, r = 280; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6d8, size: 2.2, sizeAttenuation: false, map: sparkTex(), transparent: true, opacity: .9, depthWrite: false, fog: false }))); }
  if (L.clouds) for (let i = 0; i < 10; i++) { const cl = new THREE.Group(); for (let k = 0; k < 5; k++) { const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + hash(i, k) * 6, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, fog: false, transparent: true, opacity: .9 })); puff.position.set(k * 7 - 14, hash(k, i) * 3, hash(i + 3, k) * 4); puff.scale.y = .55; cl.add(puff); } const a = i / 10 * Math.PI * 2 + hash(i, 7); cl.position.set(Math.cos(a) * 200, 60 + hash(i, 9) * 30, Math.sin(a) * 200); cl.lookAt(0, cl.position.y, 0); g.add(cl); }
  return g;
}

/* ---------------- assets ---------------- */
export const ASSETS = { models: {}, hdri: {} };
const gltfLoader = new GLTFLoader(), rgbeLoader = new RGBELoader();
const b64 = str => { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
function finishHdri(name, t, eng) { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; ASSETS.hdri[name] = eng ? eng.pmrem.fromEquirectangular(t).texture : t; }
// Preferred format: packs/<game>/manifest.json = { v, models: {name: url}, hdri: {name: url}, lazy: [names], base } (real .glb/.hdr files,
// cacheable and shared between games; built by tools/build_packs.mjs). loadPack('../packs/<game>.json') tries that manifest first and falls back
// to the legacy base64 pack.json = { models: {name: base64 glb}, hdri: {name: base64 hdr} }. opts.manifest=false forces the legacy pack.
let _eng = null;
async function loadManifest(man, manUrl, eng, onProgress) {
  const base = new URL(man.base || './', manUrl); ASSETS.manifest = { man, base };
  const lazy = new Set(man.lazy || []), names = Object.keys(man.models || {}).filter(n => !lazy.has(n)), hn = Object.keys(man.hdri || {});
  let n = 0; const total = Math.max(1, names.length + hn.length), tick = () => onProgress(.05 + .95 * (++n / total));
  await Promise.all([...names.map(name => loadModelFile(name, new URL(man.models[name], base).href).then(tick)),
    ...hn.map(name => rgbeLoader.loadAsync(new URL(man.hdri[name], base).href).then(t => finishHdri(name, t, eng), e => console.warn('hdri', name, e)).then(tick))]);
  return ASSETS;
}
const _modelLoads = {};
function loadModelFile(name, href) { return _modelLoads[name] ||= gltfLoader.loadAsync(href).then(g => { ASSETS.models[name] = g.scene; g.scene.userData.animations = g.animations; }, e => { console.warn('model', name, e); }); }
// Load models listed as lazy in the manifest (or any manifest model) after the game has started. Resolves when all are in ASSETS.models.
export async function ensureModels(names) { const m = ASSETS.manifest; if (!m) return ASSETS; await Promise.all(names.filter(n => !ASSETS.models[n] && m.man.models[n]).map(n => loadModelFile(n, new URL(m.man.models[n], m.base).href))); return ASSETS; }
export async function loadPack(url, eng, onProgress = () => { }, opts = {}) {
  _eng = eng; onProgress(.03);
  if (opts.manifest !== false && /\.json$/.test(url) && !/manifest\.json$/.test(url)) {
    const mu = new URL(url.replace(/\.json$/, '/manifest.json'), location.href);
    try { const r = await fetch(mu); if (r.ok) { const man = await r.json(); if (man && man.models) return await loadManifest(man, mu, eng, onProgress); } } catch (e) { console.warn('manifest failed, using pack', e); }
  } else if (/manifest\.json$/.test(url)) { const mu = new URL(url, location.href); const man = await (await fetch(mu)).json(); return loadManifest(man, mu, eng, onProgress); } const res = await fetch(url); const total = Number(res.headers.get('content-length')) || 4e6; const reader = res.body.getReader(); const chunks = []; let got = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(.03 + .6 * Math.min(1, got / total)); }
  const pack = JSON.parse(new TextDecoder().decode(await new Blob(chunks).arrayBuffer()));
  const names = Object.keys(pack.models || {}), hn = Object.keys(pack.hdri || {}); let n = 0; const tick = () => onProgress(.63 + .37 * (++n / Math.max(1, names.length + hn.length)));
  await Promise.all(names.map(name => new Promise(resolve => { try { gltfLoader.parse(b64(pack.models[name]), '', g => { ASSETS.models[name] = g.scene; ASSETS.models[name].userData.animations = g.animations; tick(); resolve(); }, e => { console.warn('model', name, e); tick(); resolve(); }); } catch (e) { tick(); resolve(); } })));
  for (const name of hn) { try { const td = rgbeLoader.parse(b64(pack.hdri[name])); const t = new THREE.DataTexture(td.data, td.width, td.height, THREE.RGBAFormat, td.type); t.flipY = true; t.colorSpace = THREE.LinearSRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true; ASSETS.hdri[name] = eng ? eng.pmrem.fromEquirectangular(t).texture : t; } catch (e) { console.warn('hdri', name, e); } tick(); }
  return ASSETS;
}
const MATS = {};
export const mat = (col, extra) => { const k = col + JSON.stringify(extra || {}); if (!MATS[k]) MATS[k] = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .85, metalness: 0 }, extra || {})); return MATS[k]; };
export const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2b2420, side: THREE.BackSide });
export function addOutline(root, w = 1.03) { root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.outline) { const h = new THREE.Mesh(o.geometry, OUTLINE); h.scale.setScalar(w); h.userData.outline = true; h.renderOrder = -1; o.add(h); } }); return root; }
// Clone a packed model, normalised: feet on y=0, centred, largest dimension = scale.
export function instance(name, { scale = 1, shadow = true, outline = true, tint = null, fit = 'max' } = {}) {
  const src = ASSETS.models[name]; const g = new THREE.Group(); g.name = name;
  if (!src) { const m = new THREE.Mesh(new THREE.BoxGeometry(.8 * scale, .8 * scale, .8 * scale), mat(0xff00ff)); m.position.y = .4 * scale; g.add(m); console.warn('missing model', name); return g; }
  let skinned = false; src.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  const c = skinned ? skClone(src) : src.clone(true);
  c.traverse(o => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; if (o.isSkinnedMesh) o.frustumCulled = false; if (tint) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } } });
  const box = new THREE.Box3().setFromObject(c); const size = box.getSize(new THREE.Vector3()); const d = fit === 'height' ? size.y : Math.max(size.x, size.y, size.z); const s = scale / (d || 1);
  c.scale.setScalar(s); c.position.y = -box.min.y * s; c.position.x = -(box.min.x + size.x / 2) * s; c.position.z = -(box.min.z + size.z / 2) * s;
  if (outline) addOutline(c); g.add(c); g.userData.size = size.clone().multiplyScalar(s); return g;
}
export function bones(root) { const b = {}; root.traverse(o => { if (o.isBone) b[o.name] = o; }); for (const k in b) { b[k].userData.rest = b[k].quaternion.clone(); b[k].userData.restPos = b[k].position.clone(); } return b; }
// Pose a Kenney humanoid rig (T-pose rest). Values in radians; z = arm down/up, x = swing forward/back.
export function pose(rig, p) { if (!rig) return; for (const k in rig) rig[k].quaternion.copy(rig[k].userData.rest); for (const n in p) { const b = rig[n]; if (!b) continue; const [x = 0, y = 0, z = 0] = p[n]; if (z) b.rotateZ(z); if (x) b.rotateX(x); if (y) b.rotateY(y); } }
export const POSES = {
  run: (t, s = 1) => { const ph = t * 11 * s, w = Math.sin(ph); return { LeftUpLeg: [w * .9], RightUpLeg: [-w * .9], LeftLeg: [-Math.max(0, -w) * 1.3], RightLeg: [-Math.max(0, w) * 1.3], LeftArm: [-w * .8, 0, -1.2], RightArm: [w * .8, 0, 1.2], LeftForeArm: [-.9], RightForeArm: [-.9], Spine: [.18] }; },
  walk: (t, s = 1) => { const ph = t * 7 * s, w = Math.sin(ph); return { LeftUpLeg: [w * .55], RightUpLeg: [-w * .55], LeftLeg: [-Math.max(0, -w) * .8], RightLeg: [-Math.max(0, w) * .8], LeftArm: [-w * .45, 0, -1.25], RightArm: [w * .45, 0, 1.25], LeftForeArm: [-.3], RightForeArm: [-.3] }; },
  idle: (t) => ({ LeftArm: [0, 0, -1.25 + Math.sin(t * 2) * .03], RightArm: [0, 0, 1.25 - Math.sin(t * 2) * .03], Spine: [Math.sin(t * 2) * .02], Head: [0, Math.sin(t * .7) * .2, 0] }),
  jump: () => ({ LeftUpLeg: [1.1], RightUpLeg: [.3], LeftLeg: [-1.5], RightLeg: [-.6], LeftArm: [0, 0, .4], RightArm: [0, 0, -.4] }),
  sit: () => ({ LeftUpLeg: [1.4, 0, .1], RightUpLeg: [1.4, 0, -.1], LeftLeg: [-1.3], RightLeg: [-1.3], LeftArm: [-.6, 0, -1.0], RightArm: [-.6, 0, 1.0], LeftForeArm: [-.6], RightForeArm: [-.6] }),
  cheer: (t) => ({ LeftArm: [0, 0, 1.2 + Math.sin(t * 9) * .2], RightArm: [0, 0, -1.2 - Math.sin(t * 9) * .2], Head: [-.25], Spine: [-.1] }),
  punch: (k) => ({ RightArm: [-1.6 * Math.sin(k * Math.PI), 0, 1.25 - 1.2 * Math.sin(k * Math.PI)], RightForeArm: [-.2], LeftArm: [-.6, 0, -1.0], LeftForeArm: [-1.4], Spine: [.1, -.5 * Math.sin(k * Math.PI), 0], LeftUpLeg: [.3], RightUpLeg: [-.3] }),
  swing: (k) => ({ RightArm: [lerp(-2.4, .6, k), 0, lerp(.6, 1.0, k)], RightForeArm: [-.4], LeftArm: [-.6, 0, -1.0], Spine: [.15, lerp(.5, -.6, k), 0], LeftUpLeg: [.4], RightUpLeg: [-.3] }),
  hit: (t) => ({ Spine: [-.4], Head: [-.4], LeftArm: [0, 0, .3], RightArm: [0, 0, -.3] })
};

/* ---------------- limb aiming + held items (moved from Depths, generalised) ---------------- */
// Aim limbs in WORLD-ish directions instead of Euler angles: aimLimbs(rig, root, {ru: dir, rf: dir, ...}) where each dir is a unit
// vector in the root's local frame (+Y up, +Z the way the model faces). Missing bones are skipped, so any Kenney-style rig works.
export const LIMBS = [['ru', 'RightArm', 'RightForeArm'], ['rf', 'RightForeArm', 'RightHand'], ['lu', 'LeftArm', 'LeftForeArm'], ['lf', 'LeftForeArm', 'LeftHand'], ['rt', 'RightUpLeg', 'RightLeg'], ['rs', 'RightLeg', 'RightFoot'], ['lt', 'LeftUpLeg', 'LeftLeg'], ['ls', 'LeftLeg', 'LeftFoot']];
const _a1 = new THREE.Vector3(), _a2 = new THREE.Vector3(), _a3 = new THREE.Vector3(), _aw = new THREE.Vector3(), _aq1 = new THREE.Quaternion(), _aq2 = new THREE.Quaternion(), _aq3 = new THREE.Quaternion(), _aqR = new THREE.Quaternion(), _as = new THREE.Vector3(), _am = new THREE.Matrix4();
// Rotate `bone` so the bone→child segment points along dirW (world space, normalised).
export function aimBone(bone, child, dirW) {
  if (!bone || !child || !bone.parent) return; _a1.setFromMatrixPosition(bone.matrixWorld); _a2.setFromMatrixPosition(child.matrixWorld).sub(_a1); const len = _a2.length(); if (len < 1e-6) return; _a2.divideScalar(len);
  _aq1.setFromUnitVectors(_a2, dirW); bone.matrixWorld.decompose(_a3, _aq2, _as); _aq2.premultiply(_aq1); bone.parent.matrixWorld.decompose(_a3, _aq3, _as); bone.quaternion.copy(_aq3.invert().multiply(_aq2)); bone.updateMatrixWorld(true);
}
export function aimLimbs(rig, root, dirs) { if (!rig || !root) return; root.updateMatrixWorld(true); root.matrixWorld.decompose(_a3, _aqR, _as); for (const [n, b, c] of LIMBS) if (dirs[n]) aimBone(rig[b], rig[c], _aw.copy(dirs[n]).normalize().applyQuaternion(_aqR)); }
// Orient an object parented to `bone` so its +Y points along dirW (world) with +Z close to hintW (world).
export function orientTo(obj, bone, dirW, hintW) { const y = _a1.copy(dirW).normalize(), x = _a2.crossVectors(y, hintW); if (x.lengthSq() < 1e-4) x.set(1, 0, 0); x.normalize(); const z = _a3.crossVectors(x, y); _am.makeBasis(x, y, z); _aq1.setFromRotationMatrix(_am); bone.matrixWorld.decompose(_aw, _aq2, _as); obj.quaternion.copy(_aq2.invert().multiply(_aq1)); }
// A packed model wrapped so +Y is the blade/barrel direction and the origin is the grip (grip = 0..1 along its length).
export function weaponPivot(name, len = 1, grip = .15, rot = null, opts = {}) { const pv = new THREE.Group(); const w = instance(name, { scale: len, outline: opts.outline !== false }); w.position.y = -grip * len; if (rot) { const inner = new THREE.Group(); inner.rotation.set(...rot); inner.add(w); pv.add(inner); } else pv.add(w); return pv; }
// Parent obj to a bone, cancelling the bone's world scale (Kenney rigs are scaled ~100x) so obj keeps its size in world units.
export function attach(rig, obj, boneName = 'RightHand') { const bone = rig && rig[boneName]; if (!bone) { console.warn('attach: no bone', boneName); return null; } let r = bone; while (r.parent) r = r.parent; r.updateMatrixWorld(true); bone.matrixWorld.decompose(_a1, _aq1, _as); obj.scale.setScalar(1 / (_as.x || 1)); bone.add(obj); return obj; }

/* ---------------- textures / sprites ---------------- */
let _grain = null;
export function grainTex(repeat = [6, 28]) { if (!_grain) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const n = 215 + Math.random() * 40; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${.04 + Math.random() * .06})`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3, Math.random() * 3, 0, 6.3); g.fill(); } _grain = c; } const t = new THREE.CanvasTexture(_grain); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; return t; }
const TAGS = {};
// fit=true sizes the pill to its content (used by tag()); the default keeps the fixed 512x160 canvas for callers that set their own scale.
export function tagMaterial(emoji, text, bg = '#ffffff', fg = '#1b2430', fit = false) {
  const k = emoji + text + bg + fg + (fit ? '|fit' : ''); if (TAGS[k]) return TAGS[k];
  const c = document.createElement('canvas'); c.height = 160; let g = c.getContext('2d'); let f = 54; const font = () => `900 ${f}px Unbounded, Manrope, sans-serif`;
  let W = 512; if (fit) { g.font = font(); W = clamp(Math.ceil(g.measureText(text).width + (emoji ? 140 : 40) + 44), 200, 512); }
  c.width = W; g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, W - 16, 144, 40); g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b2430'; g.stroke();
  let x = 40; if (emoji) { g.font = '96px serif'; g.textBaseline = 'middle'; g.fillText(emoji, 28, 86); x = 140; }
  g.fillStyle = fg; g.font = font(); while (g.measureText(text).width > W - x - 36 && f > 26) { f -= 4; g.font = font(); }
  g.textBaseline = 'middle'; if (fit && !emoji) { g.textAlign = 'center'; g.fillText(text, W / 2, 86); } else g.fillText(text, x, 86);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false, fog: false }); m.userData.aspect = W / 160; TAGS[k] = m; return m;
}
export function tag(emoji, text, opts = {}) { const m = tagMaterial(emoji, text, opts.bg, opts.fg, opts.fit !== false); const s = new THREE.Sprite(m); const w = opts.width || 3.2, h = w * .3125; s.scale.set(opts.fit === false ? w : h * m.userData.aspect, h, 1); s.renderOrder = 6; return s; }

/* ---------------- particles ---------------- */
let _spark = null; function sparkTex() { if (_spark) return _spark; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); _spark = new THREE.CanvasTexture(c); _spark.colorSpace = THREE.SRGBColorSpace; return _spark; }
// Pooled particles: one Points mesh per blend mode (additive / normal), fixed-capacity ring buffer, no per-burst GPU allocation.
// API unchanged: new Particles(scene[, {capacity}]) → .burst(pos, {color, n, speed, up, size, life, gravity, additive}), .update(dt).
// .list holds the active bursts (games cap effects with P.list.length). Respects E.quality(): low quality halves particle counts.
const PVS = 'attribute vec3 aColor;attribute float aSize;attribute float aAlpha;uniform float uScale;varying vec3 vC;varying float vA;void main(){vC=aColor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aAlpha>0.?aSize*uScale/max(.001,-mv.z):0.;gl_Position=projectionMatrix*mv;}';
const PFS = 'uniform sampler2D uMap;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(uMap,gl_PointCoord);if(vA<=0.||t.a<.01)discard;gl_FragColor=vec4(vC,t.a*vA);\n#include <colorspace_fragment>\n}';
export class Particles {
  constructor(scene, { capacity = 1536 } = {}) { this.scene = scene; this.cap = capacity; this.pools = {}; this.list = []; }
  pool(additive) {
    const k = additive ? 'add' : 'norm'; if (this.pools[k]) return this.pools[k]; const N = this.cap;
    const geo = new THREE.BufferGeometry(), A = (n, c) => new THREE.BufferAttribute(new Float32Array(n * c), c).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', A(N, 3)); geo.setAttribute('aColor', A(N, 3)); geo.setAttribute('aSize', A(N, 1)); geo.setAttribute('aAlpha', A(N, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: sparkTex() }, uScale: { value: 300 } }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; const sz = new THREE.Vector2();
    pts.onBeforeRender = (r) => { r.getDrawingBufferSize(sz); mat.uniforms.uScale.value = sz.y / 2; }; // matches PointsMaterial size attenuation
    this.scene.add(pts);
    const P = { pts, geo, head: 0, vel: new Float32Array(N * 3), age: new Float32Array(N), life: new Float32Array(N), grav: new Float32Array(N), base: new Float32Array(N), alive: 0 };
    return (this.pools[k] = P);
  }
  burst(pos, { color = 0xffe9a8, n = 18, speed = 4, up = 4, size = .45, life = .9, gravity = 12, additive = true } = {}) {
    if (_quality === 'low') n = Math.max(1, n >> 1); n = Math.min(n, this.cap);
    const P = this.pool(additive), c = _pc.set(color), g = P.geo.attributes;
    for (let j = 0; j < n; j++) { const i = P.head; P.head = (P.head + 1) % this.cap; if (P.life[i] <= 0) P.alive++;
      g.position.setXYZ(i, pos.x, pos.y, pos.z); g.aColor.setXYZ(i, c.r, c.g, c.b); g.aSize.setX(i, size); g.aAlpha.setX(i, 1);
      P.vel[i * 3] = rnd(-speed, speed); P.vel[i * 3 + 1] = rnd(up * .4, up); P.vel[i * 3 + 2] = rnd(-speed, speed); P.age[i] = 0; P.life[i] = life; P.grav[i] = gravity; }
    this.list.push({ t: 0, life });
  }
  update(dt) {
    for (const k in this.pools) { const P = this.pools[k]; if (!P.alive) continue; const g = P.geo.attributes, pa = g.position.array, al = g.aAlpha.array;
      for (let i = 0; i < this.cap; i++) { if (P.life[i] <= 0) continue; P.age[i] += dt; if (P.age[i] >= P.life[i]) { P.life[i] = 0; al[i] = 0; P.alive--; continue; }
        P.vel[i * 3 + 1] -= P.grav[i] * dt; pa[i * 3] += P.vel[i * 3] * dt; pa[i * 3 + 1] += P.vel[i * 3 + 1] * dt; pa[i * 3 + 2] += P.vel[i * 3 + 2] * dt; al[i] = 1 - P.age[i] / P.life[i]; }
      g.position.needsUpdate = true; g.aAlpha.needsUpdate = true; g.aColor.needsUpdate = true; g.aSize.needsUpdate = true; }
    for (let i = this.list.length - 1; i >= 0; i--) { const b = this.list[i]; b.t += dt; if (b.t > b.life) this.list.splice(i, 1); }
  }
  clear() { for (const k in this.pools) { const P = this.pools[k]; P.life.fill(0); P.geo.attributes.aAlpha.array.fill(0); P.geo.attributes.aAlpha.needsUpdate = true; P.alive = 0; } this.list.length = 0; }
  dispose() { for (const k in this.pools) { const P = this.pools[k]; this.scene.remove(P.pts); P.geo.dispose(); P.pts.material.dispose(); } this.pools = {}; this.list.length = 0; }
}
const _pc = new THREE.Color();
let _quality = 'auto';

/* ---------------- audio ---------------- */
let AC = null, master = null, musicGain = null;
export function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination); musicGain = AC.createGain(); musicGain.gain.value = profile().music ? .22 : 0; musicGain.connect(master); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
export function tone(f, d, type = 'sine', g = .16, slide = 0, delay = 0, dest) { const c = audio(); if (!c || !profile().sound) return; const t0 = c.currentTime + delay; const o = c.createOscillator(), v = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d); v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + .008); v.gain.exponentialRampToValueAtTime(.0008, t0 + d); o.connect(v); v.connect(dest || master); o.start(t0); o.stop(t0 + d + .02); }
export function noise(d, g = .12, f = 1200, q = 1, delay = 0, type = 'bandpass') { const c = audio(); if (!c || !profile().sound) return; const t0 = c.currentTime + delay; const len = Math.max(1, Math.floor(c.sampleRate * d)); const buf = c.createBuffer(1, len, c.sampleRate); const ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = buf; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const v = c.createGain(); v.gain.setValueAtTime(g, t0); v.gain.exponentialRampToValueAtTime(.0008, t0 + d); s.connect(fl); fl.connect(v); v.connect(master); s.start(t0); }
export const SFX = {
  good: () => { tone(660, .12, 'triangle'); tone(990, .18, 'triangle', .14, 0, .07); },
  bad: () => tone(220, .3, 'sawtooth', .1, -120),
  pop: () => tone(520, .08, 'square', .06),
  click: () => tone(1400, .03, 'square', .04),
  snap: () => { tone(110, .12, 'sine', .3, -40); tone(2200, .04, 'square', .05); noise(.05, .08, 3000, 2); }, // ASMR thock
  coin: () => { tone(988, .08, 'square', .06); tone(1319, .16, 'square', .06, 0, .07); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .28, 'triangle', .14, 0, i * .11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, .3, 'triangle', .12, 0, i * .14)),
  whoosh: () => noise(.35, .12, 900, .7),
  crash: () => { noise(.4, .25, 600, .5); tone(80, .3, 'sine', .25, -40); },
  splash: () => { noise(.5, .16, 1600, .6); noise(.25, .1, 400, 1, .05); },
  tick: () => tone(880, .05, 'sine', .05),
  boost: () => tone(200, .5, 'sawtooth', .07, 500),
  hit: () => { tone(160, .1, 'square', .14, -60); noise(.08, .12, 2000, 1); },
  scrub: () => noise(.12, .05, 2600 + Math.random() * 1200, 1.5),
  level: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, .22, 'square', .07, 0, i * .08))
};
// Tiny step-sequencer music. pattern: array of [noteSemitoneOffset|null], root Hz.
export function music(song) { const c = audio(); if (!c) return { stop() { } }; let stopped = false, step = 0; const beat = 60 / (song.bpm || 110) / 2; const next = () => { if (stopped) return; if (profile().sound && profile().music !== false && !document.hidden) { const n = song.lead[step % song.lead.length], b = song.bass[step % song.bass.length]; if (n != null) tone(song.root * Math.pow(2, n / 12), beat * .9, song.leadWave || 'triangle', .05, 0, 0, musicGain); if (b != null) tone(song.root / 2 * Math.pow(2, b / 12), beat * 1.6, 'sine', .07, 0, 0, musicGain); if (song.hat && step % 2 === 1) noise(.04, .025, 7000, 1); if (song.kick && step % 4 === 0) tone(90, .12, 'sine', .12, -50, 0, musicGain); } step++; setTimeout(next, beat * 1000); }; next(); return { stop() { stopped = true; } }; }
export const SONGS = {
  bright: { bpm: 112, root: 392, lead: [0, null, 4, 7, 9, null, 7, 4, 2, null, 4, null, 0, 2, 4, null], bass: [0, null, null, null, 5, null, null, null, 7, null, null, null, 5, null, 4, null], hat: true, kick: true },
  chill: { bpm: 84, root: 330, lead: [0, null, null, 7, null, 4, null, null, 2, null, null, 9, null, 7, null, null], bass: [0, null, null, null, null, null, null, null, -3, null, null, null, null, null, null, null], leadWave: 'sine' },
  race: { bpm: 140, root: 440, lead: [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5], bass: [0, null, 0, null, -2, null, -2, null, -4, null, -4, null, -5, null, -5, null], leadWave: 'square', hat: true, kick: true },
  tense: { bpm: 120, root: 294, lead: [0, null, 3, null, 7, null, 6, null, 0, null, 3, null, 8, 7, 3, null], bass: [0, 0, null, 0, -2, -2, null, -2, -4, -4, null, -4, -5, null, -5, null], leadWave: 'sawtooth', kick: true }
};

/* ---------------- speech ---------------- */
const _said = new Set();
// say(text, {lang, interrupt, once}) — once: true speaks a line only the first time this page asks for it.
export function say(text, { lang, interrupt = true, once = false } = {}) { const p = profile(); if (!('speechSynthesis' in window) || !p.voice || !text) return; if (once) { if (_said.has(text)) return; _said.add(text); } try { if (interrupt) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text)); u.lang = (lang || p.lang) === 'es' ? 'es-US' : 'en-US'; u.rate = .97; const vs = speechSynthesis.getVoices(); const v = vs.find(x => x.lang === u.lang) || vs.find(x => x.lang.startsWith(u.lang.slice(0, 2))); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) { } }

/* ---------------- input ---------------- */
// Unified input: keyboard, gamepad, touch buttons/stick, swipe. Read input.state each frame.
export function createInput(opts = {}) {
  const keys = {}; const state = { x: 0, y: 0, a: false, b: false, c: false, pause: false, aPressed: false, bPressed: false, cPressed: false, pausePressed: false, swipe: null, pointer: null };
  const prev = { a: false, b: false, c: false, pause: false };
  addEventListener('keydown', e => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); audio(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const touch = { x: 0, y: 0, a: false, b: false, c: false };
  let sw = null;
  const el = opts.surface || window;
  el.addEventListener('pointerdown', e => { audio(); sw = { x: e.clientX, y: e.clientY, t: performance.now() }; state.pointer = { x: e.clientX, y: e.clientY, down: true, start: true }; });
  el.addEventListener('pointermove', e => { if (state.pointer) { state.pointer.x = e.clientX; state.pointer.y = e.clientY; } });
  el.addEventListener('pointerup', e => { if (state.pointer) state.pointer.down = false; if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = performance.now() - sw.t; if (dt < 450 && Math.hypot(dx, dy) > 34) state.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); else if (dt < 300) state.swipe = 'tap'; sw = null; });
  function bindButton(elm, key) { if (!elm) return; const on = e => { e.preventDefault(); e.stopPropagation(); audio(); touch[key] = true; elm.classList.add('on'); }, off = () => { touch[key] = false; elm.classList.remove('on'); }; elm.addEventListener('pointerdown', on); elm.addEventListener('pointerup', off); elm.addEventListener('pointercancel', off); elm.addEventListener('pointerleave', off); }
  function bindStick(zone, knob) { if (!zone) return; let id = null, cx = 0, cy = 0; zone.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); id = e.pointerId; zone.setPointerCapture(id); const r = zone.getBoundingClientRect(); cx = e.clientX; cy = e.clientY; if (knob) { knob.style.left = (cx - r.left) + 'px'; knob.style.top = (cy - r.top) + 'px'; knob.classList.add('on'); } }); zone.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const dx = e.clientX - cx, dy = e.clientY - cy, m = 46; touch.x = clamp(dx / m, -1, 1); touch.y = clamp(dy / m, -1, 1); if (knob) knob.style.transform = `translate(calc(-50% + ${touch.x * 30}px), calc(-50% + ${touch.y * 30}px))`; }); const end = e => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; if (knob) { knob.style.transform = 'translate(-50%,-50%)'; knob.classList.remove('on'); } }; zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); }
  function poll() {
    let x = 0, y = 0; if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1; if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
    let a = !!(keys.Space || keys.KeyJ || keys.Enter), b = !!(keys.KeyK || keys.ShiftLeft || keys.ShiftRight), c = !!(keys.KeyL || keys.KeyE), pause = !!(keys.Escape || keys.KeyP);
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) { if (!p) continue; const ax = p.axes[0] || 0, ay = p.axes[1] || 0; if (Math.abs(ax) > .2) x = ax; if (Math.abs(ay) > .2) y = ay; if (p.buttons[14]?.pressed) x = -1; if (p.buttons[15]?.pressed) x = 1; if (p.buttons[12]?.pressed) y = -1; if (p.buttons[13]?.pressed) y = 1; a = a || p.buttons[0]?.pressed; b = b || p.buttons[1]?.pressed || p.buttons[7]?.pressed; c = c || p.buttons[2]?.pressed || p.buttons[3]?.pressed; pause = pause || p.buttons[9]?.pressed; }
    if (touch.x || touch.y) { x = touch.x; y = touch.y; } a = a || touch.a; b = b || touch.b; c = c || touch.c;
    state.x = clamp(x, -1, 1); state.y = clamp(y, -1, 1); state.a = a; state.b = b; state.c = c; state.pause = pause;
    state.aPressed = a && !prev.a; state.bPressed = b && !prev.b; state.cPressed = c && !prev.c; state.pausePressed = pause && !prev.pause; prev.a = a; prev.b = b; prev.c = c; prev.pause = pause;
    return state;
  }
  function consumeSwipe() { const s = state.swipe; state.swipe = null; return s; }
  return { state, keys, poll, bindButton, bindStick, consumeSwipe, touch };
}

/* ---------------- UI helpers ---------------- */
export function loading(title, sub = t('loading')) { const d = document.createElement('div'); d.className = 'ig-loading'; d.innerHTML = `<div><div class="ig-brand">INOA<span>GAMES</span></div><h1>${title}</h1><div class="ig-bar"><i></i></div><p>${sub}</p></div>`; document.body.appendChild(d); return { set(p, txt) { d.querySelector('i').style.width = Math.round(p * 100) + '%'; if (txt) d.querySelector('p').textContent = txt; }, done() { d.classList.add('out'); setTimeout(() => d.remove(), 500); } }; }
let toastTO = 0;
export function toast(text, ms = 1800, speak = false) { let t = document.querySelector('.ig-toast'); if (!t) { t = document.createElement('div'); t.className = 'ig-toast'; document.body.appendChild(t); } t.textContent = text; t.classList.add('show'); clearTimeout(toastTO); toastTO = setTimeout(() => t.classList.remove('show'), ms); if (speak) say(text); }
export function floatText(text, x, y, cls = '') { const d = document.createElement('div'); d.className = 'ig-float ' + cls; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
// Results card shared by every game: grants XP/coins to the shared profile and shows hero level.
export function results({ gameId, title, stats = [], xp = 0, coins = 0, best = null, bestLower = false, bestLabel = t('best'), onAgain, onHub = () => location.href = '../index.html', share, won }) {
  const r = reward(gameId, { xp, coins, best, bestLower }); const lv = heroLevel(profile().xp);
  const d = document.createElement('div'); d.className = 'ig-screen ig-results';
  d.innerHTML = `<div class="ig-card"><div class="ig-kicker">${r.newBest ? t('newBest') : t('roundOver')}</div><h2>${title}</h2><div class="ig-stats">${stats.map(s => `<div><b>${s[1]}</b><small>${s[0]}</small></div>`).join('')}</div>${r.best != null ? `<p class="ig-sub">${bestLabel}: <b>${r.best}</b></p>` : ''}<div class="ig-reward"><span>+${r.xp} XP</span><span>+${r.coins} 🪙</span><span>${t('heroLv')} ${lv.lv}${r.levelUp ? ' ⬆' : ''}</span></div><div class="ig-xpbar"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div><div class="ig-row"><button class="ig-btn ghost" data-a="hub">${t('hub')}</button><button class="ig-btn" data-a="again">${t('again')}</button></div>${share ? `<button class="ig-btn sun" data-a="share">📣 ${t('share')}</button>` : ''}${(won ?? r.newBest) && installAvailable() ? `<button class="ig-btn ghost" data-a="install">📲 ${t('install')}</button>` : ''}</div>`;
  document.body.appendChild(d); if (r.levelUp) SFX.level();
  d.querySelector('[data-a=again]').onclick = () => { d.remove(); onAgain && onAgain(); }; d.querySelector('[data-a=hub]').onclick = () => onHub();
  const ib = d.querySelector('[data-a=install]'); if (ib) ib.onclick = async () => { ib.remove(); await promptInstall(); };
  const sh = d.querySelector('[data-a=share]'); if (sh) sh.onclick = async () => { try { if (navigator.share) await navigator.share({ text: share }); else { await navigator.clipboard.writeText(share); toast(t('copied')); } } catch (e) { } };
  return d;
}
export function hudChip(html, cls = '') { const d = document.createElement('div'); d.className = 'ig-chip ' + cls; d.innerHTML = html; return d; }
// The standard game shell: back-to-hub, pause, touch controls container.
export function shell({ title, onPause, buttons = [], stick = false, help = '' }) {
  const top = document.createElement('div'); top.className = 'ig-top'; top.innerHTML = `<a class="ig-chip ig-home" href="../index.html" aria-label="${t('back')}">⌂</a><div class="ig-hud" id="igHud"></div><button class="ig-chip ig-pause" aria-label="${t('paused')}">⏸</button>`; document.body.appendChild(top);
  top.querySelector('.ig-pause').onclick = () => onPause && onPause();
  const pad = document.createElement('div'); pad.className = 'ig-pad'; pad.innerHTML = `${stick ? '<div class="ig-stick" id="igStick"><div class="ig-knob" id="igKnob"></div></div>' : '<div></div>'}<div class="ig-btns">${buttons.map(b => `<button class="ig-tbtn ${b.cls || ''}" id="${b.id}" aria-label="${b.label}">${b.icon}</button>`).join('')}</div>`; document.body.appendChild(pad);
  return { hud: top.querySelector('#igHud'), pad };
}
export function pauseMenu({ onResume, onRestart, extra = '' }) { const d = document.createElement('div'); d.className = 'ig-screen'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.innerHTML = `<div class="ig-card"><h2>${t('paused')}</h2>${extra}<div class="ig-row"><button class="ig-btn ghost" data-a="hub">${t('hub')}</button><button class="ig-btn ghost" data-a="restart">${t('restart')}</button><button class="ig-btn" data-a="resume">${t('resume')}</button></div><div class="ig-row"><button class="ig-chipbtn" data-a="sound">🔊 ${t('sound')} ${profile().sound ? t('on') : t('off')}</button><button class="ig-chipbtn" data-a="voice">🗣️ ${t('voice')} ${profile().voice ? t('on') : t('off')}</button><button class="ig-chipbtn" data-a="settings">⚙️ ${t('settings')}</button></div></div>`; document.body.appendChild(d); d.querySelector('[data-a=resume]').onclick = () => { d.remove(); onResume(); }; d.querySelector('[data-a=restart]').onclick = () => { d.remove(); onRestart(); }; d.querySelector('[data-a=hub]').onclick = () => location.href = '../index.html'; d.querySelector('[data-a=sound]').onclick = e => { const v = !profile().sound; setSetting('sound', v); e.target.textContent = `🔊 ${t('sound')} ${v ? t('on') : t('off')}`; }; d.querySelector('[data-a=voice]').onclick = e => { const v = !profile().voice; setSetting('voice', v); e.target.textContent = `🗣️ ${t('voice')} ${v ? t('on') : t('off')}`; }; d.querySelector('[data-a=settings]').onclick = () => settingsPanel(); setTimeout(() => d.querySelector('[data-a=resume]')?.focus({ preventScroll: true }), 30); return d; }
// Shared settings panel (sound, music, read-aloud, language, reduced motion, graphics). Saved in the profile, used by every game + the hub.
export function settingsPanel({ onClose } = {}) {
  const d = document.createElement('div'); d.className = 'ig-screen ig-settings'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', t('settings'));
  const seg = (k, opts) => `<div class="ig-seg" role="group" aria-label="${t(k === 'lang' ? 'language' : k)}" data-k="${k}">${opts.map(([v, lbl]) => `<button class="ig-chipbtn" data-v="${v}" aria-pressed="false">${lbl}</button>`).join('')}</div>`;
  const draw = () => { d.innerHTML = `<div class="ig-card"><h2>⚙️ ${t('settings')}</h2>
    <div class="ig-set"><span>🔊 ${t('sound')}</span>${seg('sound', [[1, t('on')], [0, t('off')]])}</div>
    <div class="ig-set"><span>🎵 ${t('music')}</span>${seg('music', [[1, t('on')], [0, t('off')]])}</div>
    <div class="ig-set"><span>🗣️ ${t('voice')}</span>${seg('voice', [[1, t('on')], [0, t('off')]])}</div>
    <div class="ig-set"><span>🌎 ${t('language')}</span>${seg('lang', [['en', 'English'], ['es', 'Español']])}</div>
    <div class="ig-set"><span>🌀 ${t('motion')}</span>${seg('motion', [['auto', t('auto')], ['reduced', t('on')], ['full', t('off')]])}</div>
    <div class="ig-set"><span>✨ ${t('quality')}</span>${seg('quality', [['auto', t('auto')], ['high', t('high')], ['low', t('low')]])}</div>
    <button class="ig-btn" data-a="done">${t('done')}</button></div>`;
    const S = settings(); d.querySelectorAll('.ig-seg').forEach(g => { const k = g.dataset.k; g.querySelectorAll('button').forEach(b => { const v = typeof S[k] === 'boolean' ? (S[k] ? '1' : '0') : String(S[k]); const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.onclick = () => { const raw = b.dataset.v; setSetting(k, typeof S[k] === 'boolean' ? raw === '1' : raw); SFX.click(); draw(); }; }); });
    d.querySelector('[data-a=done]').onclick = () => { d.remove(); onClose && onClose(); }; setTimeout(() => d.querySelector('[data-a=done]')?.focus({ preventScroll: true }), 30); };
  draw(); document.body.appendChild(d); return d;
}
export function titleScreen({ title, kicker, lead, how = [], onPlay, extra = '' }) { const d = document.createElement('div'); d.className = 'ig-screen ig-title'; d.innerHTML = `<div class="ig-card"><div class="ig-kicker">${kicker}</div><h1>${title}</h1><p class="ig-sub">${lead}</p>${how.length ? `<div class="ig-how">${how.map(h => `<div><span>${h[0]}</span>${h[1]}</div>`).join('')}</div>` : ''}${extra}<div class="ig-row"><a class="ig-btn ghost" href="../index.html">${t('hub')}</a><button class="ig-btn" data-a="play">${t('play')}</button></div><button class="ig-chipbtn ig-setbtn" data-a="settings">⚙️ ${t('settings')}</button></div>`; document.body.appendChild(d); d.querySelector('[data-a=play]').onclick = () => { audio(); d.remove(); onPlay(); }; d.querySelector('[data-a=settings]').onclick = () => settingsPanel(); return d; }

/* ---------------- loop ---------------- */
export function loop(fn) { let last = performance.now(); const f = now => { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; fn(dt, now / 1000); }; requestAnimationFrame(f); }
// Screen position of a 3D point (for floating text)
export function toScreen(v, camera) { const p = v.clone().project(camera); return { x: (p.x * .5 + .5) * innerWidth, y: (-p.y * .5 + .5) * innerHeight }; }

/* ---------------- procedural PBR surfaces (no texture files) ---------------- */
// Generates albedo + normal + roughness maps on canvas. kinds: asphalt, sand, grass, wood, metal, rust, tile, fabric, stone, snow, paint, plastic
const PBR_CACHE = {};
function noiseField(w, h, octaves, seed) { const f = new Float32Array(w * h); const val = (x, y, s) => hash(Math.floor(x) + s * 1013, Math.floor(y) + s * 7919); const smoothN = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = val(xi, yi, s), b = val(xi + 1, yi, s), c = val(xi, yi + 1, s), d = val(xi + 1, yi + 1, s); return lerp(lerp(a, b, u), lerp(c, d, u), v); }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let amp = 1, fr = 4 / w * 8, sum = 0, norm = 0; for (let o = 0; o < octaves; o++) { const p = Math.round(w * fr / 8) || 1; sum += smoothN((x % w) * fr, (y % h) * fr, seed + o) * amp; norm += amp; amp *= .5; fr *= 2; } f[y * w + x] = sum / norm; } return f; }
export function pbr(kind, color = 0x888888, repeat = [4, 4], opts = {}) {
  const key = kind + color + repeat.join('x') + JSON.stringify(opts); if (PBR_CACHE[key]) return PBR_CACHE[key];
  const S = 256, base = new THREE.Color(color); const h = noiseField(S, S, 5, kind.length * 31 + 7); const fine = noiseField(S, S, 3, kind.length * 13 + 3);
  const height = new Float32Array(S * S), alb = new Uint8ClampedArray(S * S * 4), rough = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; let ht = h[i], col = base.clone(), r = opts.rough ?? .85;
    if (kind === 'asphalt') { const grit = hash(x * 3, y * 7); ht = h[i] * .4 + grit * .6; col.multiplyScalar(.75 + grit * .45); r = .9; }
    else if (kind === 'sand') { ht = h[i] * .7 + fine[i] * .3; col.multiplyScalar(.85 + ht * .3); r = .95; }
    else if (kind === 'grass') { const blade = hash(x, y * 3); ht = blade; col.lerp(new THREE.Color(0x2f6b2f), blade * .35); col.multiplyScalar(.85 + h[i] * .3); r = .95; }
    else if (kind === 'wood') { const ring = Math.sin((y / S * 22 + h[i] * 6) * Math.PI) * .5 + .5; ht = ring * .6 + fine[i] * .4; col.multiplyScalar(.72 + ring * .38); r = .7; if (x % (S / 4) < 2) { ht = 0; col.multiplyScalar(.6); } }
    else if (kind === 'metal') { const br = hash(x, Math.floor(y / 2)) * .15; ht = fine[i] * .3 + br; col.multiplyScalar(.9 + br); r = .35 + h[i] * .25; }
    else if (kind === 'rust') { const spot = smooth(.45, .62, h[i]); col.lerp(new THREE.Color(0x7a3b12), spot); col.multiplyScalar(.7 + fine[i] * .5); ht = spot * .8 + fine[i] * .5; r = .45 + spot * .5; }
    else if (kind === 'tile') { const gx = x % (S / 4), gy = y % (S / 4); const grout = gx < 4 || gy < 4; ht = grout ? 0 : .8 + fine[i] * .2; if (grout) col.set(0xd8d0c4); else col.multiplyScalar(.92 + fine[i] * .14); r = grout ? .95 : .25; }
    else if (kind === 'fabric') { const weave = ((x >> 1) + (y >> 1)) % 2 ? .6 : .4; ht = weave * .6 + fine[i] * .4; col.multiplyScalar(.85 + weave * .25); r = .95; }
    else if (kind === 'stone') { ht = h[i]; col.multiplyScalar(.7 + h[i] * .5); r = .9; }
    else if (kind === 'snow') { ht = h[i] * .6 + fine[i] * .4; col.multiplyScalar(.95 + fine[i] * .08); r = .8; }
    else if (kind === 'paint') { ht = fine[i] * .2; col.multiplyScalar(.96 + fine[i] * .06); r = .4; }
    else if (kind === 'plastic') { ht = fine[i] * .1; r = .3; }
    height[i] = ht; alb[i * 4] = col.r * 255; alb[i * 4 + 1] = col.g * 255; alb[i * 4 + 2] = col.b * 255; alb[i * 4 + 3] = 255; const rv = clamp(r + (fine[i] - .5) * .15, 0, 1) * 255; rough[i * 4] = rv; rough[i * 4 + 1] = rv; rough[i * 4 + 2] = rv; rough[i * 4 + 3] = 255; }
  const nrm = new Uint8ClampedArray(S * S * 4), str = opts.bump ?? 3; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const hL = height[y * S + ((x - 1 + S) % S)], hR = height[y * S + ((x + 1) % S)], hU = height[((y - 1 + S) % S) * S + x], hD = height[((y + 1) % S) * S + x]; const nx = (hL - hR) * str, ny = (hU - hD) * str, nz = 1; const l = Math.hypot(nx, ny, nz); const i = (y * S + x) * 4; nrm[i] = (nx / l * .5 + .5) * 255; nrm[i + 1] = (ny / l * .5 + .5) * 255; nrm[i + 2] = (nz / l * .5 + .5) * 255; nrm[i + 3] = 255; }
  const tex = (data, srgb) => { const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t; };
  const m = new THREE.MeshStandardMaterial({ map: tex(alb, true), normalMap: tex(nrm, false), roughnessMap: tex(rough, false), roughness: 1, metalness: kind === 'metal' ? .7 : 0, normalScale: new THREE.Vector2(1, 1) });
  PBR_CACHE[key] = m; return m;
}
// Give a loaded model real surface detail: adds a subtle normal + roughness micro-texture to every material.
export function detail(root, kind = 'paint', strength = .5) { const p = pbr(kind, 0xffffff, [3, 3]); root.traverse(o => { if (o.isMesh && !o.userData.outline && o.material && !o.material.normalMap) { o.material = o.material.clone(); o.material.normalMap = p.normalMap; o.material.normalScale = new THREE.Vector2(strength, strength); o.material.roughnessMap = p.roughnessMap; } }); return root; }

applySettings();

/* ---------------- PWA: service worker, manifest link, install offer ---------------- */
// Every page that imports the engine joins the app: offline cache (sw.js at the site root) and an install offer
// shown on the results card after a win (never mid-game, never again once dismissed). Tests block service workers.
const ROOT_URL = new URL('../', import.meta.url);
let _installEvt = null;
export function installAvailable() { return !!_installEvt && !store.get('inoa.installDismissed', false); }
export async function promptInstall() { if (!_installEvt) return false; const e = _installEvt; _installEvt = null; e.prompt(); try { const c = await e.userChoice; if (c.outcome !== 'accepted') store.set('inoa.installDismissed', true); return c.outcome === 'accepted'; } catch (err) { return false; } }
(function pwa() {
  try {
    if (!document.querySelector('link[rel=manifest]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = new URL('manifest.webmanifest', ROOT_URL).href; document.head.appendChild(l); }
    if (!document.querySelector('link[rel=icon]')) { const l = document.createElement('link'); l.rel = 'icon'; l.href = new URL('favicon.png', ROOT_URL).href; document.head.appendChild(l); }
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvt = e; });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register(new URL('sw.js', ROOT_URL).href, { scope: ROOT_URL.pathname }).catch(() => { }));
  } catch (e) { }
})();
