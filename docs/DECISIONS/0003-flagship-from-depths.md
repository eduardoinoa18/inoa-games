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
