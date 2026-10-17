# Inoa Games — architecture (as built, 2026-10-17)

This describes what is in the repository today, not plans. Deeper references:
- `docs/ENGINE.md`: engine API
- `docs/PLATFORM_ARCHITECTURE.md`: accounts, entitlements, billing, database
- `docs/MULTIPLAYER.md`: rooms, phones, online play
- `docs/SCALABILITY.md`: cost and capacity
- `docs/APP_STORES.md`: native wrappers

## 1. Shape
```
Browser / PWA / Capacitor app
 ├─ index.html (hub, generated from hub-src/ by tools/build_hub.py)
 ├─ games/<game>.html ── engine/inoa3d.js (three.js r170 via import map, jsDelivr; vendored in the apps)
 │                    ├─ engine/ui.css, engine/feedback.js
 │                    ├─ packs/<game>/manifest.json → packs/assets/models/*.glb (meshopt, content-hashed), hdri/*.hdr
 │                    └─ engine/net.js → engine/rtc.js (party rooms: Supabase Realtime signalling/relay + WebRTC DataChannel)
 ├─ pad.html (phone controller; joins a room by QR / 4-letter code)
 ├─ account.html, admin.html, pricing.html ── engine/platform.js (no three.js)
 └─ sw.js (offline cache: hub + engine precached, each game cached after first play)

Supabase (shared project, Inoa objects prefixed ig_*): Auth, Postgres RPCs with RLS + security-definer functions, Realtime
Vercel: static hosting of the repo root + api/*.js functions (Stripe checkout/portal/webhook; gated off by BILLING_ENABLED)
```
There is no build step for the site. `tools/` scripts regenerate the hub, the packs and the app bundle, and their outputs are committed.

## 2. Client
- **Engine** (`engine/inoa3d.js`): renderer, post-processing and auto quality drop; sky/HDRI; pack loader with JSON fallback; `instance()` and rig posing; particles; synth SFX and music; `say()` speech; unified input (keys, touch pad, gamepad, swipe, phones); UI (title, pause, settings, results, toast); profile v2 and `results()`. 12 of the 13 games use it. **Pixel Pact 2D** is standalone canvas code with its own copy of the reward rules.
- **Test hooks:** every game sets `window.__READY` and `window.__GAME` (`update(dt)`, state getters), which the Playwright harness drives (`docs/TESTING.md`).
- **Localization:** EN/ES strings live in each page, following the hub/settings language (`inoa.lang`). There is no shared string catalogue and no automated missing-string check yet (roadmap R2).

## 3. Data
| Data | Where | Authority |
| --- | --- | --- |
| Hero profile (XP, coins, level, hero, per-game best/plays) | `localStorage` `inoa.profile` (guest) or `inoa.profile.u.<uid>` (signed in) | Local first; signed in → `ig_finish_round` caps and records rewards server-side, de-duplicated by round id |
| Game saves (unlocks, café, island, shop…) | `localStorage`, scoped `<key>.u.<uid>` when signed in (`engine/savekeys.js`) | Local first; synced keys go to `ig_saves` with revision checks (`PLATFORM_ARCHITECTURE.md` §15). Safari child profiles are never uploaded |
| Accounts, status, entitlements, events, feedback, referrals | Supabase `ig_*` tables, RLS on, direct table access revoked, RPC-only | Server |
| Party rooms | Supabase Realtime channels (ephemeral) + peer-to-peer WebRTC | The host browser is authoritative |

## 4. Security boundaries
- The browser holds only the publishable anon key and the legacy anon JWT for Realtime (`platform.json`). Service keys and Stripe secrets live in Vercel env vars only. Nothing secret is committed.
- No user role is ever granted from the client. Admin comes from `ig_grant_owner_by_email`, run by the owner in the SQL editor and audited.
- Rewards are capped per round and per day on the server. There are no public leaderboards, so client scores are never ranked against strangers.
- Communication is limited to private room codes, host approval for each phone and preset reactions. There is no chat, no free-text messaging and no public profiles.

## 5. Known architectural debts
1. ~~Game saves are device-wide and local only (F1)~~: fixed 2026-10-17 (cloud saves).
2. Pixel Pact 2D duplicates the engine's reward and profile logic.
3. There is no shared i18n catalogue or completeness check.
4. Online play on separate screens exists only in Drift. A generic host-authoritative room helper does not exist yet. It is needed for Card Room, online Tide Lines and Depths.
5. `instance({fit:'height'})` over-sizes skinned rigs (~1.5×). Fixing it changes every game's scale, so the fix is deferred.
6. Real-device performance is unmeasured. Headless numbers don't represent a phone.
