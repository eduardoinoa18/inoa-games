# Junkyard to Jewel — audit notes

## Elevation pass (2026-10-15)
See the "Junkyard to Jewel elevation pass" section in `docs/AUDIT.md` for the full list. Agent notes:

- **Framing**: one fit for both orientations. `fitCam()` projects the 8 corners of the vehicle's voxel box at the current turntable
  angle (±0.1 rad so spinning does not pump) and solves the camera distance per corner (`|lateral| / (tan · margin) + depth`), inside
  the band the HUD, step chip, palette, spin buttons and garage buttons leave free. It runs every frame (the band is re-measured every
  400 ms). Portrait width 0.69–0.87 over a full turn (was 0.58–0.85 with the footprint-diagonal fit, ~0.45 nose-on); landscape no longer
  uses the loose bounding sphere (was 27% of the width at the start).
- **Progress you can actually reach**: at build time each exterior voxel is tested for a line of sight along 36 orbit directions
  (12 yaws × 3 pitches) through the voxel grid. Hidden voxels (wheel wells, cab floor, gaps behind wheels) get weight 0 in every stage.
  Test: sweeping rays from 8 angles × 2 tilts reaches ≥ 92% wash on the hatchback, the fire engine and the sail ship.
- **Rust under paint**: re-checked in `junk_paint_done(_p)`. The orange patches in the portrait shot are the hatchback's tail and side
  lamps (`lightBack`), not rust. Sanded rust is fully cleared, so no shader change was needed.
- **Brush**: coalesced pointer samples are queued and re-cast along the path (≤ 80 rays a frame, ~10 px apart), so fast curves stay
  continuous. A surface-aligned brush ring shows where the tool works and how big it is (also on mouse hover). Two fingers anywhere
  spin and tilt the turntable, even if the first finger landed on the vehicle.
- **Designs** are drawn by the grime shader in the vehicle's own space, so no UVs are needed: two-tone, stripes, band, wave, dots and
  stars (dots and stars use a box projection picked by the face normal from `dFdx/dFdy`). The accent colour also paints the
  secondary paint material on two-colour models (`acc` regex per vehicle). Wheels recolour `_default*`/`rim` materials.
- **Boats**: `body` regex per vehicle (`/./` = whole rowboat; `^wood` = sail ship hull, sails and iron stay). Stage 2 text says
  "Sand old varnish" for boats.
- **Engine**: unchanged. Uses `E.menuNav()` (title, orders, photo card) and `E.platformStart()` for order starts.

## Phase 1 (kept)
Fast-stroke re-tracing, no paint across air, `pointercancel`/blur end the stroke, portrait framing, EN/ES via `E.L`, gamepad pause,
results exactly once. Test coverage from Phase 1 is still in `test/junk.js`.

## Known issues
- Real-phone feel and FPS are not measured (headless SwiftShader only). Vehicle build is 80–600 ms headless (voxelise + reach pass).
- The voxel grid is 76 cells on the long axis, so a design edge is soft on the 5 m vehicles, about 6 cm.
- Stars and dots on strongly curved panels stretch where the box projection switches faces.
- Some Kenney models use `_defaultMat` for the grille as well as the hubs, so a wheel finish can tint a small grille part.
- No scooter, plane or train: no CC0 model of those is in `assets/models`. `bike.glb` is 4.7 MB, and `citroen-old-van` is skipped because of the brand name.

## Engine requests
- none
