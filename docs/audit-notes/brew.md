# Brew and Bloom — polish pass (games/brew.html, test/brew.js)

## What changed (by feature)
- **Portrait brew panel**: the panel was never actually drawn twice — the audit was reading a 2-up contact sheet. The real portrait problems were fixed instead: the 3D ingredients now sit in one row, the overlapping 3D labels are hidden in portrait, and the recipe card has a 6-button ingredient tray (big tap targets that show counts and highlight what the recipe still needs) with Back on the same row. The portrait test now finishes the shift and screenshots the real results card (`brew_p_results`).
- **Barista**: the pack's `survivor-female` texture has red skin and dirt/blood stains. The barista now uses the `male` model (white shirt + green waistcoat, reads as café staff). It is scaled to 0.78, because the chunky-head rig is about 2.5 m to the top of the head, and stands at the left end of the counter facing the teapot. The brew camera is framed and steeper in both orientations, and leaves room for the recipe card in portrait.
- **Guest textures**: at load, `cleanCharTex()` removes the grey-brown stains from the `survivor-male/female` textures and recolours the red skin to a warm brown. No assets were added.
- **Greenhouse view (portrait)**: the camera fits the diorama's projected width for the current orbit angle, and starts at a front-on angle in portrait. No more side clipping.
- **Labels**: pot and order tags are laid out in screen space (kept inside the safe area, overlaps pushed apart). Portrait uses compact labels and staggers alternate pot labels. The test checks for 0 off-screen labels.
- **Offline summary**: `awayMinutes()` ignores missing, invalid or future timestamps and caps absence at 7 days. `lastSeen` is saved before any payout, so reloads never pay twice. Tips are capped at 60. On load the save is sanitised: numbers, pots (unknown seed or non-numeric `t0` dropped, future `t0` clamped to now), decor and walls.
- **Results**: guarded by `sess.resulted`, so `E.results` runs once per shift. The countdown pauses while a modal is open, so pausing during it can no longer swallow the results. A cup still in flight can't trigger a second results card.
- **Input**: Space/A starts from the title; A confirms the welcome-back, results and pause cards. In seed/unlock sheets A picks the first option. In decor mode, ←/→ moves through the cards and A selects; then the arrows move the ghost, A places, B deselects and B/E exit. Brew: ←/→ + A, digits 1–6, tray taps, drag.
- **EN/ES**: an English/Español toggle on the title, stored in the profile's `lang` (so `E.say` speaks Spanish). Translated: title, how-to, toasts, sheets, recipe card, decor, welcome-back, results, recipe/seed/decor/visitor names and the chalkboard menu.

## Tests (PORT=8820)
- Landscape: NO_ERRORS
- Portrait 390×844: NO_ERRORS
- New assertions: drag adds an ingredient; the brew completes; results appear with `resultsCount === 1` (and still 1 after 4 more seconds); a floor tap in decor mode doesn't open brew; decor exits; the offline payout happens once (tips > 0 and ≤ 60), then two more reloads pay nothing; future/invalid timestamps are sanitised (no NaN coins, future pot clamped, bogus pot dropped); the Spanish UI loads.

## Remaining known issues
- Landscape brew view (560 px tall): the barista's head touches the HUD row, and the bottoms of the 3D ingredient labels touch the top of the recipe card.
- The pack loaded fine through the new manifest/meshopt + Float32 dequantize engine path; no broken models seen.
- Every humanoid guest uses the same oversized chunky-head rig (about 2.5 m tall). Seated guests look a little large next to the chairs. A global fix belongs in `instance(fit:'height')` (the bounding box ignores the bone pose).
- The decor `shelf` placement at (-1, .5) is rejected (blocked path). That is expected; the test just logs it.
- The engine title/pause buttons and the "Play again" / "Hub" labels are English-only (engine strings).
- The Spanish title card in landscape (560 px tall) scrolls (engine card layout).

## Engine requests
- `instance(..., {fit:'height'})` should measure the skinned bounding box with bones applied (the Kenney characters come out about 1.5× the requested height).
- `toScreen()` should call `camera.updateMatrixWorld()`; otherwise it lags one frame behind camera moves made since the last render.
- Engine UI strings (Play/Hub/Paused/Resume/Play again/ROUND OVER) in ES.
- An optional "clean texture" step in the pack build for the survivor characters (stains/red skin), instead of fixing them at runtime per game.

---

# Elevation pass (2026-10-15)
Summary in `docs/AUDIT.md` → "Brew and Bloom elevation pass". Notes for the next agent:
- **Progression data** lives at the top of `games/brew.html`: `SEEDS`/`RECIPES`/`DECOR` carry `lv` (unlocking café level), `orig` (first-release content, stays open for legacy saves) and `season`. `LEVELS` maps lifetime hearts → level; `unlocksAt(l)` builds the level-up list. Add content by adding rows; the journal, seed sheet, decor shop, chalkboard and brew counter all read these tables.
- **Requests**: `ensureRequests()` (seeded by the local date string, 3 regulars, distinct teas you can make today), `progressRequests()` in `serve()`, stories in `REGULARS[].story` (EN/ES pairs).
- **Save v2** fields: `lvl` (last celebrated level), `legacy`, `book {teas, plants}`, `friends {name: chapters}`, `req {day, list, bonus}`. A v1 save with any play gets `legacy = true` and `lvl = level()`.
- **Camera**: `fitView(key, points, dir, target, margins)` — projection fit + pan, memoised. Margins come from the HUD, touch buttons (`padRects()`), recipe card or decor panel.
- **Character scale**: `fixCache` measures each rig's skinned bounding box once and scales to 1.6 m. If the engine fixes `instance(fit:'height')`, this becomes a no-op (factor ≈ 1).
- Test hooks added: `level`, `LEVELS`, `ensureRequests`, `RBY`, `BI` (visible ingredient row), `note`, `openBook/closeBook/book`, `setSeason`, `findSpot(id, r)`, `decorTap`, `fixCache`.
