# Driftwood Builders — Phase 1 audit notes

## What changed (games/builders.html)
- **Engine/pack compatibility (P0):** the lead's new manifest packs ship meshopt + KHR_mesh_quantization GLBs. The game's local `mergeStatic()` baked world matrices into int16-normalized attributes, which clamped them (fruit trees lost their leaves, black slabs at every trunk base). Attributes are now de-quantized to Float32 before merging (`toFloatAttr`).
- **Camera occlusion:** the old code hid trees outright (it even hid the tree you were chopping). Now anything between the camera and the player (feet, chest, head) or the build ghost fades to a see-through copy of its own material (cached per material + level, outlines hidden), then fades back. Covers trees, rocks, bushes, walls and roofs (you can see yourself inside a house). Anything hugging the camera (<2 m) fades too. The camera also slides in/up when a hill blocks the view (`terrainClear`).
- **Trees/rocks:** one recolour pass on the source models, so materials stay shared (no more per-instance tint clones). Fixes the near-black fruit-tree trunks, teal/olive big trees, pink rocks and the dark red benches/beds. Every tree, rock and bush now sits on the lowest terrain point under its footprint (`footY`), with no floating downhill edge. Stumps sit at the same height. Dock deck is lighter.
- **Palette (phones):** ‹ › arrow buttons, edge-fade mask, scroll-snap, the selected piece centred, and smaller cards ≤640 px. There is a compact two-column layout for short landscape phones. The tip always sits just above the palette. Keys: Q/[ previous, C/] next, 1–9 pick; a hint line shows on desktop. Gamepad: LB/RB cycle, LT undo, Back toggles Remove, Start pauses, and A/B work the title, results, pause and sheets.
- **Toasts:** a local `toast()` wrapper keeps the engine toast in a free lane below the quest card, day chips and visit banner. The portrait visit banner moved above the stick.
- **Boats/docks:** the bow now faces the sailing direction (it used to sail sideways). Boats moor side-on, parallel to the shore or dock, bow to deeper water. The hull sits in the water (y −0.16), including after you hop off, and the boat's rotation is saved. Boats, docks and the sailing player cast no shadow on the sea floor (that shadow was the "dark ghost").
- **Results:** `endOfDay` is guarded, so only one results card can be open at a time. Sleep can't be triggered twice.
- **EN/ES:** quests, piece names, tips/errors, toasts, title, results and the visit banner follow `profile().lang`. `E.say` lines are translated too.

## Tests (test/builders.js extended)
Added: an occlusion sweep (4 angles × 2 zooms), an inside-house shot, a palette first-item visibility check, key and gamepad piece cycling, gamepad pause/resume, DOM overlap checks (toast/quest/day/visit/palette/tip), boat mooring state, and a results-once check.
- Landscape: `NO_ERRORS`. Every layout check prints "clean"; palette "visible"; results once {granted:1, after:1, cards:1}.
- Portrait 390×844: `NO_ERRORS`, same checks clean.
- Shots worth reviewing: builders_[p_]start, swing, occ_5, occ_11, house, inside, build, build_pal, build_pal_end, sail, visit, results.

## Known issues
- Palm fronds beside the camera can still sit at the screen edge when they don't block the player (by design).
- The final edit (boat height after hopping off) came after the last test run.
- Real-phone drag/touch feel is not verified headlessly.

## Engine requests
- `instance()` with `tint` clones materials per instance; a cached tinted-material option would help.
- A shared occluder-fade helper (it's implemented locally here).
- Gamepad navigation for engine cards (title, results, pause), and a `pausePressed` that is gamepad-only (Esc already arrives as a key event).
- A toast "lane/offset" option, so games can keep toasts clear of their HUD cards.

# Elevation pass (2026-10-15)
See the "Builders elevation pass" section in `docs/AUDIT.md`. Key code landmarks in `games/builders.html`: `ISLES` / `homeH` / `isleH` / `isleAt` (islands), `loadSave` (v1→v2 migration), `FOLK` / `WISHES` / `updateFolk` (islanders), `TRADES` / `openTrade`, `STAMPS` / `openPostcards`, `wrapUp`, `updateAmbient`. PKEYS order is stored in saves and share codes: only append new pieces; palette order lives in `PAL`. Test shots worth reviewing: builders_[p_]shell_sail, fish, trade, folk, wish, bridge, moss, lighthouse, postcards, wrap, tile.
