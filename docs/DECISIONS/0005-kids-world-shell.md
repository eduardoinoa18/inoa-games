# 0005 — Kids World shell

**Status:** DECIDED (direction). **Recommendation:** build the shell *with* the first new kids' game, not as a separate project, and extract only what two games actually share.

## Shared (`engine/kids.js` + `engine/kids.css`, new)
Big-target UI (≥ 64 px), a voice-first instruction helper (EN/ES `E.say` with recorded-voice override), gentle feedback sounds and animations, a parent gate (a hold-to-open + simple math prompt) on settings and any external link, no timers by default, a per-child profile picker (Safari already has one; generalize it).

## Not shared
Each game's mechanic and rendering. Safari stays on its own 3D scene; new mini-games may be lightweight 2D.

## Order
1. **Bubble Pop Counting** first: simplest mechanic, it proves the shell, and it is quick to test with kids.
2. Then Animal Sounds Match.
3. Expand only after watching real kids play (owner + family testers).
Safari's existing profile picker and big-text mode are the reference.

## Status 2026-10-17: shell v1 built with Bubble Pop Counting
`engine/kids.js` + `engine/kids.css` now hold exactly what a second kids' game (Animal Sounds Match) would reuse. Everything is additive; `engine/inoa3d.js` is unchanged.
| Piece | API | Notes |
| --- | --- | --- |
| Big targets | `bigButton({icon, text, label, cls, onClick})`, `minTargetPx()` | `.kd-big` is ≥ 64 × 64 px; the test asserts it |
| Voice first | `instruct(line)`, `repeat()`, `lastLine()`, `repeatButton()`, `speak(line)`, `numberWord(n, lang, gender)` | Lines are `{en, es}` through `E.say` (follows `E.lang()` and the read-aloud setting). Spanish feminine numbers ("una burbuja"). The repeat button pulses when a new instruction is given |
| Gentle feedback | `success({el})`, `gentle({el})`, `chime(i)`, `praise()`, `tryAgain()`, `rewardOverlay({stars, sticker, title})` | Soft sine tones only (no buzzer), a bounce or a wobble, rotating encouraging lines. No countdown or lives helpers exist on purpose |
| Parent gate | `parentGate({onPass, onCancel})`, `guardLinks({selector})`, `gateOpen()`, `guardStats()` | Press and hold 1.5 s (pointer, Space/Enter, or gamepad A; timed from the press, so slow devices still open), then a two-digit sum with three answers; 3 wrong answers close it. `guardLinks()` gates ⌂, every `<a href>`, Hub, settings, phones, feedback, install and share buttons, including menus the engine builds later. A panel marked `data-kids-unlocked` (opened through the gate) is not gated twice. Nothing is stored or sent |
| High contrast | `html.kd-hc` | The game toggles it from its grown-ups panel |

**Not in v1:** the per-child profile picker (Bubble Pop saves no names, so nothing needed it yet; generalize Safari's when Animal Sounds Match needs per-child progress) and a recorded-voice override for `instruct()` (the line objects are the hook: add an `audio` field later).

## Status 2026-10-17 (later): second user, Memory Match
`games/memory.html` uses the shell for its **Little ones** mode only (big picture cards ≥ 96 px, pictures named aloud, `success()`/`tryAgain()`, `rewardOverlay()`, `repeatButton()`, parent gate). One additive change: `guardLinks({enabled})` + `setGuard(on)` so a game can gate part of itself (the grown-up modes of the same page link to the hub without a gate). Bubble Pop is unchanged (`guardLinks()` still defaults to on).
