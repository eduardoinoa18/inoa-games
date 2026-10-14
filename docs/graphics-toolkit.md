# Inoa Games — 3D graphics toolkit

What is installed in `pixel-pact/toolkit/` and how every game on the shelf uses it.

## Rendering stack (browser, no engine license)
- **three@0.170.0** — WebGL renderer, GLTF loading, PMREM environment lighting, PCF soft shadows, ACES tone mapping.
- **three/addons postprocessing** — EffectComposer, RenderPass, UnrealBloomPass, SMAAPass, OutputPass, ShaderPass (custom vignette). Also available: GTAOPass/SSAOPass (desktop only), OutlinePass, BokehPass, FilmPass.
- **postprocessing@6.36.4 (pmndrs)** — alternative higher-performance composer with N8AO-style effects when needed.
- **@dimforge/rapier3d-compat@0.14.0** — WebAssembly physics for the signature titles (Fail Tray, Island Drift, Depths, Builders).
- **three-stdlib** — extra loaders and controls.
- In an artifact page the modules load from `cdn.jsdelivr.net/npm/three@0.170.0/...` through an import map; locally Playwright routes those URLs to `node_modules/three`.

## Asset pipeline
- **@gltf-transform/cli + core/functions + draco3dgltf** — `convert.mjs` decodes Draco, strips `KHR_materials_unlit` so models take real lighting, dedups/welds/prunes and writes optimized `.glb`.
- **Source library: pmndrs/market-assets** (sparse clone in `assets-market/`): ~300 CC0 low-poly models (Kenney), 12 Poly Haven HDRIs, PBR materials. License field 1 = CC0.
- Converted models live in `pixel-pact/assets/models/*.glb` (49 files, 2.2 MB) and HDRIs in `assets/hdri/`.
- Artifacts only serve standard web types, so binaries ship as `assets/pack.json` (base64, ~5 MB) and the page parses GLB/HDR in memory (`loadAssets()` in `allergy2/engine.js`).

## Engine conventions (allergy2/engine.js is the reference)
- `instance(name, {scale, tint, outline})` clones a model, normalizes it (feet at y=0, size by largest dimension) and adds an inverted-hull outline for the toon look.
- Gradient sky dome shader + clouds/stars/moon per level; HDRI is used for reflections and fill light only (environmentIntensity 0.1–0.25) so colors stay controllable.
- Directional sun follows the player for shadow quality; shadow map 2048, bias -0.0006.
- Water: vertex-displaced plane with foam shader. Particles: additive `Points` bursts.
- Procedural bone animation on Kenney humanoid rigs (Hips/Spine/Head/LeftArm/RightUpLeg...) via `animateRig()`.
- Auto quality: if measured FPS < 40, pixel ratio drops to 1.25 and bloom turns off.

## Testing
- `python3 -m http.server 8765` in `pixel-pact/`, then `scratchpad/aa2test.js` (renders) and `aa2play.js` (drives the game loop with fixed timesteps) under headless Chromium with SwiftShader.

## Marketplace plugins worth enabling later
- **Unity** (Unity Technologies) — for the native app builds and store submission phase.
- **parallax-threejs** — Three.js/GLSL debugging and visual regression testing.
