# Inoa Games arcade — builder guide

Every game is one page at `arcade/games/<id>.html` that imports the shared engine `arcade/engine/inoa3d.js` and loads its own asset pack `arcade/packs/<id>.json`. The finished arcade is published as one multi-page web artifact: `index.html` (the hub) links to `games/<id>.html`. **Read `games/drift.html` first — it is the reference implementation and the quality bar.**

## Hard constraints (the page runs inside a sandboxed artifact)
- Scripts only from `cdn.jsdelivr.net` (three@0.170.0 via the import map in drift.html). No other CDNs, no network APIs, no WebSockets, no servers. Fonts only from Google Fonts (link tags as in drift.html).
- Assets come only from packs built with `python3 arcade/build_pack.py <id> --models a b c --hdri dawn`. Model names = files in `assets/models/*.glb` (list in `arcade/models.txt`; preview thumbnails at `toolkit/assets-market/files/models/<name>/thumbnail.png`). HDRIs: dawn, sunset, studio, interior, forest, city. Keep a pack under ~8 MB (check heavy models with `ls -la assets/models`). All models are CC0 (Kenney etc.).
- Never use real brands, franchises or real people. Everything original.
- Must work on a phone (touch), a laptop (keyboard) and with a gamepad. Text readable at phone size. No horizontal scroll.
- `localStorage` only via `E.store` (it can throw).
- Do not edit `engine/inoa3d.js` or `engine/ui.css`. If you need a helper, write it inside your game file. Note anything you think belongs in the engine in your final report.

## Page skeleton
Copy the `<head>` of drift.html (fonts, `../engine/ui.css`, the import map) and start the module with:
```js
import * as E from '../engine/inoa3d.js';
const { THREE, clamp, lerp, rnd, pick, hash, damp, SFX, $ } = E;
const ld = E.loading('Game Name', 'Loading…');
const R = E.createRenderer($('gl'), { fov: 55, portraitFov: 70, shadowSize: 30 });
await E.loadPack('../packs/<id>.json', R, p => ld.set(p));
// build scene, title screen...
ld.done(); window.__READY = true;
E.loop((dt) => { update(dt); R.render(dt); });
window.__GAME = { /* hooks for tests: state, update, start... */ };
```

## Engine API (engine/inoa3d.js)
- `createRenderer(canvas, opts)` → `{renderer, scene, camera, sun, hemi, composer, bloom, resize, render(dt), setLook(L), setEnv(tex)}`. ACES tone mapping, soft shadows, bloom (subtle by default), SMAA, vignette, auto quality drop under 40 fps. Move `sun.position`/`sun.target` with the action so shadows stay sharp.
- `setLook({skyTop, skyHor, skyGlow, sunDir, fog, fogNear, fogFar, sun, sunColor, hemi, ground, exposure, env, bloom, bloomThreshold, stars, clouds, background})` — gradient sky dome + clouds/stars, fog, light balance. Use `background: 0x...` for indoor scenes (no sky). Keep bloom ≤ .2 by day; lights must never be overwhelming.
- `setEnv(E.ASSETS.hdri.dawn)` — HDRI for reflections/fill (env intensity in setLook, keep .1–.25).
- `loadPack(url, R, onProgress)`; `E.ASSETS.models[name]`.
- `instance(name, {scale, tint, outline=true, shadow=true, fit:'max'|'height'})` → Group normalized: feet on y=0, centred, size = scale. `detail(root, kind, strength)` adds micro surface normal/roughness.
- `pbr(kind, color, [rx, ry], {bump, rough})` → procedural PBR material (asphalt, sand, grass, wood, metal, rust, tile, fabric, stone, snow, paint, plastic). Use these instead of flat colors for floors, walls, roads, tables.
- `mat(color, extra)` cached MeshStandardMaterial. `addOutline(root)` toon outline.
- Humanoids (rigged, Kenney T-pose rig): skater-female, skater-male, survivor-female, survivor-male, cyborg-female, male, zombie-1, zombie-2. `const rig = E.bones(model)`, then `E.pose(rig, E.POSES.run(t))` each frame. POSES: run, walk, idle, jump, sit, cheer, punch(k 0..1), swing(k), hit. Pose values are `{BoneName: [x, y, z]}` radians; arms hang with z ≈ ∓1.25 (Left −, Right +). Bones: Hips, Spine, Chest, UpperChest, Neck, Head, Left/RightShoulder, Left/RightArm, Left/RightForeArm, Left/RightHand, Left/RightUpLeg, Left/RightLeg, Left/RightFoot. Non-rigged characters (pirate-captain, pirate-officer, pirate-crew) can only be moved/bobbed whole.
- `tag(emoji, text, {width, bg, fg})` sprite label; `tagMaterial(...)`.
- `new E.Particles(scene)` → `.burst(vec3, {color, n, speed, up, size, life, gravity, additive})`, call `.update(dt)`.
- Audio: `SFX.good|bad|pop|click|snap|coin|win|lose|whoosh|crash|splash|tick|boost|hit|scrub|level()`, `tone(f, dur, wave, gain, slide, delay)`, `noise(dur, gain, freq, q)`, `music(E.SONGS.bright|chill|race|tense)` → `{stop()}`.
- `say(text)` — speech (EN/ES from profile; respects the read-aloud setting). Read important instructions aloud for young players.
- `createInput({surface})` → `{poll() → state {x, y, a, b, c, pause, aPressed, bPressed, cPressed, swipe}, consumeSwipe(), bindButton(el, 'a'|'b'|'c'), bindStick(zone, knob), touch, keys}`. Keyboard: WASD/arrows, Space/J = a, Shift/K = b, L/E = c, Esc/P = pause. Gamepads automatic.
- UI: `loading(title)`, `titleScreen({title, kicker, lead, how:[[icon, text]], extra (html), onPlay})`, `shell({onPause, buttons:[{id, icon, label, cls}], stick})` → `{hud}` (top bar with home + pause; put chips in `hud.innerHTML`), `pauseMenu({onResume, onRestart})`, `toast(text, ms, speak)`, `floatText(text, x, y, cls)`, `results({gameId, title, stats:[[label, value]], xp, coins, best, bestLower, bestLabel, onAgain, share})` — **always end a round with results()**: it grants XP/coins to the shared hero profile the hub shows.
- `profile()`, `heroLevel(xp)`, `reward()`, `store.get/set`, `toScreen(vec3, camera)`, `loop(fn)`.
- CSS classes in ui.css: `.ig-card .ig-btn(.ghost/.sun/.coral) .ig-chip .ig-chipbtn(.on) .ig-row .ig-stats .ig-big .ig-tbtn(.big) .ig-stick .ig-knob`. Palette vars: --mint-ink, --sun, --coral, --berry, --paper, --ink.

## Quality bar (what "done" means)
1. Real 3D scene with packed models, procedural PBR floors/walls, sky or indoor backdrop, soft shadows, a camera that frames the action on landscape AND portrait phones.
2. A complete loop: title screen (how to play, options) → play with HUD → clear win/finish → `results()` → play again. Pause works. Back to hub (⌂) works.
3. Friendly by default (forgiving, no harsh fail states for kids' games; optional harder mode for adults where it fits), juicy feedback (particles, SFX, screen shake capped, floating text), music.
4. Controls: keyboard + touch buttons/stick + gamepad. Read key instructions aloud with `say()` where a child might not read.
5. No console errors. 60 fps target: instancing for repeated meshes, reuse geometries/materials, cap particles.

## Testing (mandatory)
- Harness: `PORT=<your port> node arcade/test/run.js <id> arcade/test/<id>.js` (run from /home/claude/pixel-pact). It serves `arcade/`, routes three.js to local node_modules, waits for `window.__READY`, then runs your script `module.exports = async (page, shot) => {...}`; `shot(name)` saves `arcade/test/out/<id>_<name>.png`. It prints `NO_ERRORS` or the page errors.
- Drive the game from the test through `window.__GAME` hooks (call `update(1/60)` in loops inside `page.evaluate`, yield with `await new Promise(r=>setTimeout(r,0))` every ~20 steps). See `test/drift.js`. Add an autopilot/bot hook if needed so a full round can complete headlessly.
- Look at your screenshots (Read the PNGs; combine several into one sheet with PIL to save effort) and fix what looks wrong: bad framing, clipping, invisible meshes (check face winding / DoubleSide), overexposure, unreadable text, characters facing backwards, things floating.
- Test at 1000×560 (landscape) and `W=390 H=844` (portrait phone).
- Rendering in the harness is software (SwiftShader) and slow — simulate with `update()` rather than waiting in real time.
