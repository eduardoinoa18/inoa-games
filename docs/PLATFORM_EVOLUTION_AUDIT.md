# Platform evolution audit (Phase 7 baseline) — 2026-10-15

Scope: what exists before accounts, billing and the admin dashboard are added; what must change; the risks. Confirmed facts are marked **[confirmed]** (seen in code, tests or provider consoles); assumptions are marked **[assumption]** and must be checked before launch.

## 1. Current architecture [confirmed]
- Static site: `index.html` (hub, generated from `hub-src/`) + 13 pages in `games/` + `engine/inoa3d.js` (shared Three.js r170 engine) + `packs/` (manifest + shared meshopt `.glb`/`.hdr`) + `thumbs/`. No build step.
- PWA already in place: `manifest.webmanifest`, `sw.js` (hub + engine precached, each game cached after first play, offline reload verified by `test/pwa.js`), install offer on the results card after a win, `404.html`.
- Tests: Playwright harness `test/run.js` + one script per game (26/26 pass at 1000×560 and 390×844), `test/engine.js`, `test/index.js`, `test/pwa.js`, `test/hero.js`.
- No server code, no environment variables, no secrets in the repo (checked: `grep -ri "secret\|api_key\|sk_" --include=*.js --include=*.html` finds nothing sensitive).

## 2. Profile and localStorage behaviour [confirmed]
- `localStorage['inoa.profile']` (engine `profile()`, v2): `{v, name, xp, coins, games: {id: {plays, best, last, newBest}}, recent, lang, voice, sound, music, motion, quality, hero: {model, color}}`. Written by `E.reward()` (via `E.results()`), the settings panel and the hub (name, hero, language, daily-challenge coins).
- Per-game stores (`inoa.drift`, `inoa.runner`, …) hold game-local preferences and ghosts. `inoa.daily` holds the daily-challenge state.
- Everything is client-generated and untrusted: anyone can edit XP/coins in DevTools. Fine for a single-device toy; **not acceptable** once progress, limits or rewards matter across devices.
- Rewards are de-duplicated client-side (`reward()` ignores a repeat for the same game within 3 s; several games add their own once-guards).

## 3. Accounts / authentication [confirmed]
None. No login, no server identity, no email.

## 4. Profile and results APIs [confirmed]
- `E.results({gameId, title, stats, xp, coins, best, bestLower, won, ...})` → `E.reward()` → profile write + results card. Called exactly once per round in every engine game (agents added guards in Phase 1).
- Safari and Pixel Pact (2D) have their own start/results flows (Safari calls `E.results`; Pixel Pact uses an inline reward shim).
- 11 of 13 games start play through `E.titleScreen({onPlay})`; Safari and Pixel Pact use custom title screens. This gives **one engine hook** for the free-start gate plus two small per-game hooks.

## 5. PWA status [confirmed]
Installable, offline-capable for cached games, versioned caches (`inoa-core-v1`, `inoa-run-v1`, `inoa-assets-v1`). Needs: never cache authenticated API responses; an update notice; account pages must handle offline.

## 6. Hosting and deployment [confirmed]
- `vercel.json` (static, `cleanUrls: false`, cache headers). **No Vercel project exists** for this repo on the owner's team (projects: eduardoinoa, viventa, the-story-vault), so nothing deploys today.
- Work lives on branch `claude/stoic-cerf-nrjges`; `main` has only the original import.
- Supabase org `eduardoinoa18` is on the **Free plan with 2 active projects** (WebDesigns/Presentations, viventa-rd) — the free plan's usual project limit **[assumption: 2 free projects per org]**. A dedicated Inoa Games project needs a decision (pause one, upgrade, or reuse).

## 7. Analytics / tracking [confirmed]
None. No third-party scripts besides jsDelivr (three.js) and Google Fonts.

## 8. Screens and games needing account integration
| Surface | Needed |
| --- | --- |
| Hub | Sign-in state, remaining free starts + reset time, plan badge, Continue row from server progress, upgrade/pricing, account page link, admin link (owner only) |
| New pages | `account.html` (register, verify, login, reset, settings, delete), `pricing.html`, `admin.html` |
| Engine | Start gate in `titleScreen` (+ `E.platformStart` for custom flows), server finish in `results()`, session expiry before "Play again", offline handling |
| Safari, Pixel Pact | Call the gate on their own Play buttons |
| All games | No change to gameplay code; hooks live in the engine |

## 9. Security risks (current and introduced)
| Risk | Severity | Mitigation |
| --- | --- | --- |
| Client-authored XP/coins/best become "real" once synced | High | Server RPC `finish_round` clamps per-round rewards, one reward per (session, round key), minimum round time, daily XP cap; one-time capped import of local progress |
| Free limit bypass (clear storage, edit JS, change clock, parallel requests) | High | Atomic server upsert on `(user_id, usage_date)` with `usage_date` from the database clock (UTC); client value only displayed |
| Cross-account reads/writes | High | RLS on every table, explicit `select own` policies, column-level grants (players can only update `display_name`, `hero`, `lang`, `public_profile`) |
| Self-granted premium/admin | High | No client write access to `subscriptions`, `user_roles`, `account_status`; writes only via `SECURITY DEFINER` functions checking `is_admin()` or via the service role (webhook) |
| Owner credentials in code | High | None stored; owner role granted by a SQL script run in the Supabase dashboard; every admin RPC checks the role server-side |
| Forged payment success | High | Entitlement only from verified Stripe webhooks (HMAC-SHA256 signature + timestamp tolerance), idempotent by event id, ordered by event `created` |
| XSS through display names | Medium | Names validated server-side (1–24 chars, no `<>`), escaped on render (hub already escapes) |
| Account enumeration | Medium | Supabase Auth generic responses; our UI never says "no such account" |
| Service worker caching private data | Medium | SW never handles Supabase/`/api/` requests (network only) |
| Abuse (signup floods, start spam) | Medium | Supabase Auth rate limits + captcha option; per-user DB checks; Vercel function limits |

## 10. Subscription and access requirements
- Free: 3 qualifying game starts per UTC day (definition in `docs/PLATFORM_ARCHITECTURE.md` §5), verified email required to start.
- Premium $4.99/month: no daily limit, all active games. Status from Stripe webhooks only. Test mode until the owner approves live charging.

## 11. Proposed architecture
Vercel (static site + 4 small serverless functions for Stripe) + Supabase (Auth, Postgres with RLS, SQL RPC functions for game starts, rewards and admin) + Stripe (Checkout, Billing portal, webhooks). Details and alternatives: `docs/PLATFORM_ARCHITECTURE.md`.

## 12. Expected recurring costs [assumption — from 2026 secondary sources; confirm on official pricing pages]
| Item | While testing | At paid launch |
| --- | --- | --- |
| Vercel | Hobby $0 (non-commercial only) | **Pro ~$20/month** (Hobby forbids commercial use) — or Cloudflare Pages (free tier allows commercial use) |
| Supabase | Free $0 (pauses after 7 idle days, 500 MB DB, ~50k MAU) | **Pro ~$25/month** (no pausing, 8 GB DB, 100k MAU, compute credit) |
| Auth email | Supabase default SMTP (heavily rate-limited, not for production) | Custom SMTP, e.g. a transactional provider's free tier (~3k emails/month) |
| Stripe | Test mode $0 | ~2.9% + $0.30 per card charge + ~0.7% Billing → ≈ $0.48 of each $4.99 (net ≈ $4.51) |
| **Total fixed** | **$0** | **≈ $45/month** → break-even ≈ 10 subscribers (before tax/refunds) |

## 13. Migration risks
- Players' existing local progress: imported once into the account (capped, see architecture §7); local data kept for offline/guest play.
- Games must keep working with no backend configured (tests, offline, local dev): the platform layer is **off unless `platform.json` says `enabled: true`**, and fails open to the current local behaviour when the backend is unreachable only for guests — never grants premium.
- Branch/deploy state: nothing is live yet; first deploy needs the Vercel project.

## 14. Implementation plan
Phase 7 schema + RLS + RPCs tested on a local Postgres 16 with a Supabase-compatible `auth` shim → Phase 8 client accounts (`engine/platform.js`, `account.html`) → Phase 9 start gate + allowance UI → Phase 10 Stripe test-mode functions → Phase 11 `admin.html` → Phase 12 PWA/offline rules → Phase 13 achievements + share cards → Phase 14 hardening. External steps the owner must do (create Supabase project, Stripe account/test keys, Vercel project + env vars, owner sign-up) are listed in `docs/PLATFORM_ARCHITECTURE.md` §11.
