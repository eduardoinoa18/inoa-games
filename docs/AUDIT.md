# Inoa Games — living audit

Severity: **P0** broken/blocker · **P1** major (game-breaking, progression, severe mobile) · **P2** polish/usability/content · **P3** minor.
Status words used below mean exactly: *implemented* (code exists), *tested* (headless test passed), *visually verified* (screenshots inspected at 1000×560 and 390×844), *deployed*, *production verified*.

## Baseline — 2026-10-15 (commit b9397b9)

### Executive summary
- **13 games** confirmed in `games/` (12 on the shared engine + `pixelpact.html` 2D, and `safari.html` which embeds its own older engine copy). 12 have headless tests; Pixel Pact has none.
- **The test harness was broken on a clean install (P0, fixed):** `require.resolve('three/package.json')` fails because three@0.170 restricts `exports`. Nobody could run `npm run test:all` from a fresh clone. Fixed in `test/run.js`; portrait screenshots now get a `_p` suffix so they no longer overwrite landscape ones (several tests still write fixed names — see per-game notes).
- After the fix: **all 24 runs (12 games × landscape + portrait) print `NO_ERRORS`**. Pixel Pact loads without errors in both orientations.
- **The committed hub was stale (P0, fixed by rebuild):** `index.html` marked 8 live games as SOON / PHASE 1 and linked them to `#shelf`, so Builders, Tide Lines, Fit, Tray, Junk, Trivia, Draw and Runner were unreachable from the front page. `python3 tools/build_hub.py` now regenerates it correctly.
- **No Vercel project exists for this repo** on the connected Vercel team (projects: eduardoinoa, viventa, the-story-vault). Nothing is auto-deploying. Needs the owner to import the GitHub repo into Vercel (or run `npx vercel --prod` logged in).
- **Hub makes claims the product does not implement (P1, honesty):** pricing ($4.99 / $9.99 Pact Pass), "every phone is a controller", host rooms with 4-letter codes + QR, "notify me at launch", "10 s link to lobby", "14 games". Online play does not exist (static site). These must be reworded as roadmap or removed.
- Shared engine is small (264 lines), coherent and used consistently. Main gaps: no settings panel / language toggle UI, particles allocate per burst, no manifest/file asset loading, no lifecycle/visibility pause, profile has no versioning or per-game de-dupe guard.
- Biggest visual problems: Brew and Bloom portrait (duplicated brew panel, clipped greenhouse), Driftwood Builders (palm trunks occluding camera, palette clipped on phones, toasts overlapping quest card), Depths portrait (bottom 40% of screen empty, overlapping banner texts), Trivia portrait (question board cut off), Tide Lines portrait close-up (camera inside the player).

### Shared engine (`engine/inoa3d.js`, `engine/ui.css`)
| Sev | Finding | Fix |
| --- | --- | --- |
| P1 | `reward()` has no idempotency: a game calling `results()` twice grants twice. Profile has no `v` field / migration. | Add `roundId` de-dupe + versioned profile (Phase 3). |
| P1 | Packs are base64 JSON (3.4–6.7 MB each, ~33% larger than the binaries, must be fully downloaded + parsed before anything shows). | Manifest + real `.glb/.hdr` files, keep JSON fallback (Phase 2). |
| P2 | `Particles.burst` allocates a geometry + material per burst and disposes on expiry → GC churn. | Pooled Points per effect type (Phase 3). |
| P2 | No shared settings UI: pause menu only toggles sound + read-aloud; no music, language, reduced-motion or quality controls; `lang` exists in profile but nothing in the shell sets it. | Shared settings panel (Phase 3). |
| P2 | `loop()` keeps rendering when the tab is hidden (rAF pauses, but music `setTimeout` sequencer keeps scheduling notes). | Pause music on `visibilitychange`. |
| P2 | `say()` cancels any speech each call; no de-dupe of repeated lines. | Additive option `once`. |
| P2 | Engine UI strings (Paused, Hub, Resume, Play again, ROUND OVER, Hero lv…) are English only. | Localise engine UI (Phase 3). |
| P3 | Fog is fixed near/far per look; huge maps (Drift ×2.1) get flat fog. | Camera-distance fog helper (Phase 3). |
| P3 | `tag()` sprites with no emoji leave a wide empty pill (Drift/Tide Lines name tags look like blank white boxes). | Size the pill to the text. |

### Hub (`index.html` ← `hub-src/`)
| Sev | Finding |
| --- | --- |
| P0 | Stale build: 8 live games unreachable (fixed by rebuild; CI-like check needed so it can't regress). |
| P1 | Misleading marketing: pricing, online rooms/QR, phone-as-controller, "notify me", app-store roadmap presented as product. |
| P1 | Only 4 tile thumbnails (`thumbs/`): 9 games show procedural canvas art or blank tiles. |
| P2 | Hero maker is 2D-only and only stores `name`; no model/colour choice reaches games. |
| P2 | No per-game best / play count on tiles, no Continue row, no daily challenge, no EN/ES toggle. |
| P2 | Tile/hero canvases draw only when on screen (fine in use; blank in full-page captures). |
| P3 | Copy says "Fourteen games" (Pixel Pact and Match are one page → 13 pages, 14 entries). |

### Per game
Tests: L = 1000×560, P = 390×844. Time = wall-clock on a 4-core box with software GL.

#### Island Drift — `games/drift.html` (reference) · L/P NO_ERRORS (284 s / 146 s)
- Works: full 3-lap GP vs 5 AI to results, time trial, 2 tracks, items, drift turbos, minimap.
- P2 Title card overflows a 560 px tall landscape screen (heading scrolled off; card scrolls).
- P2 AI name tags are blank-looking white pills; item slot shows a lone "·" when empty.
- P2 During a drift the chase camera lets the kart slide almost off frame (both orientations).
- P2 Content: only 2 tracks, no ghost, no cup, AI identical in personality.

#### Tide Runner — `games/runner.html` · NO_ERRORS (173 / 130)
- Works: lanes/jump/slide, power-ups, daily seed, ghost, friendly vs classic.
- P3 Portrait: hearts chip wraps to a second HUD row over a cloud. Otherwise clean.

#### Tide Lines — `games/tidelines.html` · NO_ERRORS (296 / 146)
- Works: 4v4 bots, live %, bombs, judge sweep, results.
- P1 Portrait close-up shot: camera clips inside the player model (no near-camera occlusion handling).
- P2 Palm tree canopy occludes the player in the final 10 s shot; name tags blank pills.
- P2 One map only.

#### Perfect Fit — `games/fit.html` · NO_ERRORS (375 / 113)
- Works: real mouse drags, wrong-drop feedback, keyboard placing, 8 levels, auto-solve, before/after, results.
- P2 Portrait: box + mat are small (≈50% width); lv7 (Picnic Basket) lid art overlaps the slots in portrait.
- Note: test writes fixed names, portrait overwrote landscape; landscape re-run needed.

#### Junkyard to Jewel — `games/junk.html` · NO_ERRORS (566 / 124)
- Works: real mouse scrubbing on voxel mask, 4 stages, reveal, Day 1 vs Day 30 slider, gallery, 8 vehicles.
- P2 Portrait: vehicle occupies ~40% width; could frame tighter. P3 paint stage shows the underlying rust texture through sprayed colour until polish.

#### Brew and Bloom — `games/brew.html` · NO_ERRORS (394 / 143) — builder was interrupted
- Works: planting, real-time growth, offline summary, guests, brew drag, decor, time of day, results.
- P1 Portrait: brew panel rendered twice side by side (overflows width); `p_results` shot shows the brew screen instead of results (portrait test path never reaches results).
- P1 Barista at the counter (brew view) is a huge dark-red blocky figure filling the top half — model too close / wrong tint.
- P2 Portrait greenhouse view clipped on the left; floating name/timer labels overlap and run off-screen.
- P2 Guest name tags overlap each other near the counter.

#### Driftwood Builders — `games/builders.html` · NO_ERRORS (208 / 133) — builder was interrupted
- Works: gather, quests, build palette + ghost, dock + boat, day/night, sleep → results, photo mode, share/visit.
- P1 Camera occlusion: palm trunks fill the foreground (swing shot) — no occluder fade.
- P1 Portrait build palette is clipped (first item cut off at the left edge, needs horizontal scroll affordance).
- P2 "Quest complete" toast overlaps the quest card (both orientations); visiting banner overlaps toast.
- P2 Tree tints inconsistent (some near-black), trees placed with visible base offsets; dark ghost shape under the boat in water.

#### Fail Tray — `games/tray.html` · NO_ERRORS (248 / 165)
- Works: 8 courses, wobble physics, slow-mo replay, hot-seat, party final.
- P3 "TABLE 7" sign clips into a tree; tie result wording fine. Test writes fixed names (landscape overwritten).

#### Pact Trivia — `games/trivia.html` · NO_ERRORS (404 / 223)
- Works: solo vs bots, 4 local buzzers, steal, wager, secret answers, EN/ES, kids mode.
- P1 Portrait: the question board is cut off on answer/correct/winner camera shots (camera too close for portrait FOV).
- P2 Question bank (~160) needs fact-check (Phase 5).

#### Draw the Pact — `games/draw.html` · NO_ERRORS (260 / 150) — final test was running when builder stopped; re-run passes
- Works: party (pass, peek, reveal, scores), Speed Sketch to gallery wall, Telephone chain + slideshow, undo, eraser, sizes, colours, EN/ES.
- P1 **No gamepad support** (no `createInput`/`getGamepads`).
- P2 Stylus pressure is read from `PointerEvent.pressure` but cannot be verified headlessly.

#### Pixel Pact: Depths — `games/depths.html` · NO_ERRORS (61 / 40 — DEPTHS_MODE full, autopilot wins)
- Works: 4 classes, AI allies, P2 drop-in, 8 rooms + boss, boons, camp.
- P1 Portrait: room occupies the top ~55%; bottom of the screen is empty black (camera not framed for portrait).
- P2 Big banner texts overlap ("ROOM CLEAR" over boss title, "THOUSAND CUTS" over "ROOM CLEAR"); damage numbers clutter; boss intro blown out (bloom on white boss).
- P2 Results say "9/9 rooms" for 8 rooms + boss. Story bots dodge too perfectly (known).

#### Snack Squad Safari — `games/safari.html` · NO_ERRORS (42 / 32)
- Works (per code + 2 shots): title, level 1 play.
- P1 Not on the shared engine (embeds its own renderer/loader/audio copy); awards XP through an inline `__inoaReward` shim instead of `E.results` (no best score, no shared results card).
- P1 **No gamepad support.** Test covers only title + 1 second of play (no rescue, no levels 2–5, no portrait check of labels).
- P1 Action-plan / rescue wording (epinephrine auto-injector, 911) **must be reviewed by a board-certified allergist before families use it.** Not medically reviewed. Do not change it on assumptions.

#### Pixel Pact (2D) — `games/pixelpact.html` · loads NO_ERRORS L/P (no test)
- Works: adventure + match, 1–4 local players, gamepads.
- P1 No `window.__GAME` hooks or test; rewards through inline shim (no best score); not on the engine.

### Load sizes (baseline, measured from repo files)
| Pack | MB (base64 JSON) |
| --- | --- |
| drift 6.7 · draw 6.0 · fit 5.7 · safari 5.7 · trivia 5.0 · depths 4.9 · builders 4.7 · brew 4.5 · runner 4.4 · tray 4.0 · tidelines 3.5 · junk 3.4 | three.js (jsDelivr, ~700 KB module graph) on top |
FPS on real devices: **not measured** (headless is software GL; numbers there are not representative).

### Execution order (from this audit)
1. Phase 1: Builders, Brew, Draw (gamepad), Fit/Junk portrait framing, Depths/Trivia/Tide Lines portrait cameras, Safari engine migration + gamepad + fuller test, Pixel Pact hooks; hub honesty pass.
2. Phase 2: file packs + manifest, PWA.
3. Phase 3+: as in CLAUDE.md.

---

## Phase 1 status — finish and fix all games (2026-10-15)

Each game below was changed by one game agent and then **re-tested by the lead** at 1000×560 and 390×844 (both `NO_ERRORS`), with screenshots reviewed. Agent write-ups: `docs/audit-notes/<game>.md`. "Real device" checks (touch feel on a phone, stylus pressure on hardware) are **not** done — headless synthetic events only.

| Game | Result | Fixed | Still open |
| --- | --- | --- | --- |
| Driftwood Builders | Tested + visually verified | Occluders fade (trees/rocks/walls/roofs, player visible inside house), camera pull-in on hills; trees grounded + untinted; phone palette with ‹ › + centred selection; toasts below quest card; boats face travel direction, sit in water, no ghost shadow; results once; EN/ES; gamepad | Palm fronds at screen edge (not blocking); real-phone touch feel |
| Brew and Bloom | Tested + visually verified | Barista re-cast + reframed; portrait ingredient tray; labels kept on screen + de-overlapped; save sanitising; offline summary capped/once (test reloads twice); results once; EN/ES; gamepad. (Audit's "panel drawn twice" was a misread of a 2-up contact sheet.) | Barista head touches HUD in landscape brew view; guests slightly large vs chairs |
| Draw the Pact | Tested + visually verified | All 3 modes both orientations; real pointer accuracy ≤1 px, undo/eraser/sizes/pressure fallbacks, pointercancel + resize; **gamepad added** (menus + cursor drawing); language consistent with profile; results once per mode | Gamepad-only players cannot type Telephone descriptions; real stylus untested |
| Perfect Fit | Tested + visually verified | Drop judged under the pointer (<2 px, also at edges); touch lift offset; cancel/blur safe; portrait mats ~95% width, upright lids; EN/ES; results once | ~80–100 px unused table on some portrait levels |
| Junkyard to Jewel | Tested + visually verified | Fast strokes re-traced (no gaps), no paint across air, cancel ends stroke; portrait car fills ~92% width; reveal/slider framing; EN/ES; gamepad pause; results once. Rust under paint = intended primer | Palette covers lower turntable in landscape |
| Snack Squad Safari | Tested + visually verified against `safari_before_*` | **Migrated onto engine/inoa3d.js** (all 25 inventoried features kept), **gamepad added**, `E.results` (best recorded), `__GAME` hooks; safety text unchanged | Rescue steps have no Spanish (needs allergist + translator); 911 script always names "Dawn Trail picnic area"; rescue speech bubble clipped at 390 px |
| Pixel Pact: Depths | Tested + visually verified | Portrait camera; banner queue (1 at a time); merged damage numbers; boss intro bloom .2; honest "8/8 rooms + boss"; Story allies react late / miss / roll less; EN/ES | Dark floor strip under the room in portrait (behind touch pad on phones); class/boon names EN only |
| Pact Trivia | Tested + visually verified | Every camera shot fits the board in portrait; score chips full width; toasts off the board; kids mode never subtracts; wager keys/gamepad; language follows profile; results once | Pause menu text refreshes on reopen only |
| Tide Lines | Tested + visually verified | Camera keeps ≥3.2 m from player and lifts out of props; props fade when blocking; close-up mode; name-tag clutter cut; EN/ES; results once with `won` | One map; blaster follows aim not forearm |
| Island Drift | Tested + visually verified | Chase camera keeps the kart in frame while drifting; compact name tags; hero default + kart tint | Kart sits right of centre in portrait drifts |
| Pixel Pact (2D) | Tested | `__GAME`/`__READY` hooks + `test/pixelpact.js`; best level recorded; results de-duped | Not on the engine (Phase 5 rebuild) |
| Tide Runner, Fail Tray | Tested (baseline) | — | P3 polish (hearts chip wrap; sign clipping) deferred to Phase 5 |

### Allergist review required (Snack Squad Safari)
Every safety-relevant string (EN + ES) is listed verbatim in `docs/audit-notes/safari.md` → "For allergist review": the drill card, rescue steps (tell a grown-up, epinephrine auto-injector "blue cap off, orange to the outer thigh", hold and count, call 9-1-1, lie down and wait), symptom lists, disclaimers and friend-offer lessons. **None of it has been medically reviewed.** The game states it "teaches habits, not medicine" and to follow one's own action plan. Do not market it to families until a board-certified allergist signs off; the missing Spanish rescue steps must be translated and reviewed together.

### Cross-cutting fixes made during Phase 1
- Test harness fixed for clean installs; portrait screenshots suffixed; service workers blocked in tests.
- Hub rebuilt (8 games were unreachable) and honest copy (no pricing / online rooms / QR claims).
- Survivor character textures cleaned for all ages (dirt/torn splotches, red skin) at the asset level (`tools/clean_textures.mjs`), so every game gets the clean version.
- Engine: compact name tags, scrollable title cards, results best only when passed.
