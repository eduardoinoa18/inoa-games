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
