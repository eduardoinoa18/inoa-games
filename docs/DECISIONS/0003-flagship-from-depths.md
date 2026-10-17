# 0003 — Flagship "Hometown & the Depths" grows out of Pixel Pact: Depths

**Status:** DECIDED (direction), with a feasibility spike required before scope is committed. **Recommendation:** stay on the current web stack. **No Unity** unless the spike measures a blocker the web stack cannot solve.

## What exists to reuse (`games/depths.html`, ~194 KB, `inoa3d.js`)
4 classes, combat with limb aiming, 19 boons, AI allies, P2 and phones as players, 2 acts × 8 rooms, 2 bosses, EN/ES, results integration, and a save (`inoa.depths`) for unlocks and the act-2 key.

## What the spike must answer (2–4 days, throwaway branch)
| Question | How to measure | Pass bar |
| --- | --- | --- |
| Can a walkable town (one square, ~6 NPCs, shops as facades) render at target on a 2021 mid-range phone? | Build a greybox town scene in a copy of `depths.html` from existing pack models. Use the engine's quality auto-drop and frame-time HUD; check on a real phone | ≥ 45 fps sustained at the "medium" tier; ≤ 150 draw calls |
| Can the game move between town and dungeon without leaks? | Unload and reload 20 times; watch `renderer.info` memory and geometry counts | Flat counts after 20 cycles |
| Does the save model extend? | Design `inoa.depths` v2 with `town` and `quests` sections plus a migration from v1 | Old saves load unchanged |
| Online co-op later? | Paper design only: host-authoritative like Drift, using `net.js` | Documented, no code |

## Why not Unity now
Everything that exists (engine, 13 games, packs, PWA, party rooms, accounts) is web. A second engine would mean a second asset pipeline, a second UI and localization stack, and native-only builds that lose the "one link, no download" promise. It would also mean ~10–40 MB WebGL builds and duplicate maintenance by a one-person team. Revisit only with spike evidence.

## Rollback / safety
`games/depths.html` stays playable as it is today. The town ships behind a menu entry, e.g. "Hometown (preview)", until the full loop passes its acceptance test: enter the town → take a quest → clear a dungeon → get the reward once → return → the progress survives a reload.

## Spike results (2026-10-17): headless part done, phone part pending
Page: `labs/hometown.html` (deployed, unlinked, noindex; HUD always on). Measured by `node test/run.js labs/hometown.html test/spike_hometown.js`:

| Question | Result | Verdict |
| --- | --- | --- |
| Draw calls for a town square (10 houses, 8 palms, 8 benches, 4 vehicles, a ferris wheel, fountain, 6 NPC rigs) | **399 calls as loaded → 103 after baking** with the new additive `E.bakeStatic(group)`: one mesh per material *look*, since copies of identical materials across model files are grouped. NPCs cost 18, shadows ~35 | ✅ under the 150 budget |
| Town ↔ dungeon transitions without leaks | 20 build/dispose cycles of a 24-prop room: GPU geometry count **flat** (136 every cycle); textures and programs flat | ✅ no leak, if rooms dispose only what they create (pack resources are shared) |
| Save model | `inoa.depths` v2 = v1 fields + `town: {quests: {id: state}, unlocked: [...], gold}`. Missing keys read as defaults, so v1 saves load unchanged. Synced like other saves (`engine/savekeys.js`, ≤ 64 KB) | ✅ design only, no code yet |
| Frame rate on a 2021 mid-range phone | Software GL headless can't tell (~130 ms/frame, meaningless) | ⏳ **Open `/labs/hometown.html` on the owner's phone and note the HUD fps.** Pass bar: ≥ 45 fps |

**Recommendation:** go for the town MVP (R10) on the web stack once the phone shows ≥ 45 fps, with these rules:
- bake every static town prop;
- at most about 8 visible NPC rigs;
- shadows only from baked meshes and NPCs;
- rooms dispose only what they create;
- keep Depths playable as-is.

If the phone shows < 45 fps, try the "medium" quality tier (DPR 1.25, no bloom) before considering anything bigger.
