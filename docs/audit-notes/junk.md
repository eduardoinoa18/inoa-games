# Junkyard to Jewel — audit notes (Phase 1)

## Changes
- **Brush feel**: rays use the canvas rect. Fast strokes re-cast along the screen path since the last frame, up to 40 samples about 10 px apart; this replaces the old world-space lerp that skipped jumps over 4× brush radius. The trail breaks when the pointer leaves the car, so no paint bridges across air. `pointercancel`, `lostpointercapture` and blur end the stroke at once. A flick-spin's speed is clamped.
- **Portrait framing**: the camera fits the spinning car by its footprint diagonal, not a loose bounding sphere. It is centred in the free band between the HUD/step chip and the spin buttons or colour palette, and eases when that band changes. Play starts side-on on phones, so the car is about 92% of the width (was about 45%). The reveal eases out slightly on phones instead of pushing in, so it stays in frame. During the Day 1 / Day 30 wipe the car turns side-on. Landscape framing is unchanged.
- **EN/ES via E.L**: vehicle names and stories, colour names, stage names and spoken lines, title/how, HUD, step chips, palette label, banners, toasts, slider labels, Finish/Back, gallery buttons, results, pause line. Re-renders on `inoa:settings`.
- **Gamepad**: Start now pauses (`pausePressed`). The first keyboard/pad brushing reads the controls aloud once.
- **Paint stage "rust through colour"**: checked, not a bug. Unsprayed areas show the old faded paint plus grey primer where rust was sanded. Rust is fully removed once the sand stage completes, and `paint_done` is clean. It reads as the intended base coat.
- **Test** (`test/junk.js`) checks:
  - floor drag spins and never brushes
  - single dab paints the voxel under the pointer only
  - hit point = pointer on screen
  - one-frame fast stroke fills the path
  - touch `pointercancel` stops painting
  - touch brushing after a resize
  - keyboard and fake gamepad (brush, spin, pause)
  - read-aloud text
  - `E.results` exactly once, even with a double-click on Finish
  - Spanish menu and step names
  - car width fraction in portrait
  - Shots use a `_p` suffix in portrait.

## Results
- Landscape: `ALL CHECKS PASSED` / `NO_ERRORS`
- Portrait: `ALL CHECKS PASSED` / `NO_ERRORS`
- Screenshots: `junk_start(_p)`, `junk_paint(_p)`, `junk_paint_done(_p)`, `junk_reveal(_p)`, `junk_slider(_p)`, `junk_start_es(_p)`, `junk_pause(_p)`

## Known issues
- In landscape the palette bar covers the lower turntable (not the car). That was the existing design.
- Brush on low-UV models is fine (the mask is voxel-based, no UVs needed). Still needs a check on a real phone.

## Engine requests
- none
