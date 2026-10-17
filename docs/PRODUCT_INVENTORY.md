# Inoa Games — product inventory (canonical)

Verified against the repository on 2026-10-17, at commit 3f1737d on `main`, which is what is live at https://inoa-games.vercel.app. Edit this file whenever a game, mode, URL or category changes. Quality findings are in `docs/AUDIT.md`. Open decisions are in `docs/DECISIONS/`.

## 1. How we count
| Count | Number | What it means |
| --- | --- | --- |
| **Game products** | **13** | Each one is a separate game with its own page in `games/`. The hub says "13 games", which matches |
| Hub tiles | 14 | Pixel Pact has two tiles: Adventure, and Match. Both open `games/pixelpact.html` |
| Game pages (URLs) | 13 | `games/<file>.html` |
| Support pages | 8 | `index.html` (hub), `pad.html` (phone controller), `account.html`, `admin.html`, `pricing.html`, `privacy.html`, `terms.html`, `404.html` |
| Retired games | 0 | — |
| Proposed new games (not built) | 15 | Card Room 6, quick-play 3, young-kids pack 6. See `docs/ROADMAP.md` |
| Flagship (not built) | — | "Hometown & the Depths" is a plan to grow Pixel Pact: Depths. It is not a separate product yet |

Earlier planning text that mixed "13 entries", "10 standalone games + flagship", two merges and a racing retirement described *proposals*. None of those merges or the retirement has happened.

## 2. Games
Primary category uses the proposed hub categories (`docs/DECISIONS/0007-hub-categories.md`). Every game supports touch, keyboard, gamepad and phones as controllers through the engine or `engine/net.js`; the exceptions are noted. Every game has a headless test, `test/<file>.js`.

| # | Game (page) | Audience | Modes / content | Players | EN/ES | Primary category (proposed) | Engine | Main open items |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Pixel Pact** (`pixelpact.html`) | 6+ / family co-op | **Adventure**: World 1 has 10 islands on a world map, 3 bosses, Sun Gems and secrets. **Match**: Stocks, Coin Rush and King of the Hill on 5 arenas, with bots. 6 heroes | 1–4 local + phones, drop-in | Yes + read-aloud | Adventures (Match tile: Action) | Own 2D canvas code (not on `inoa3d.js`) | Real-phone feel. Islands 1–1 to 1–3 have long jumps. Reward code is a copy of the engine rules |
| 2 | **Pixel Pact: Depths** (`depths.html`) | 10+ | 3D co-op roguelite, 4 classes, 2 acts × 8 rooms, 2 bosses, 19 boons | 1–4 (AI allies, P2, phones) | Yes | Adventures (becomes Open World if the flagship ships) | `inoa3d.js` | Real-phone FPS. Story balance |
| 3 | **Island Drift** (`drift.html`) | 6+ | Kart racer: 4 tracks, 5 AI rivals, items, Island Cup, time trial with ghost, Easy/Normal/Hard | 1 + 5 bots; online races on separate screens | Yes | Action & Racing* | `inoa3d.js` (reference game) | Real-phone feel. Ghost and cup are offline only |
| 4 | **Snack Squad Safari** (`safari.html`) | 4–10 with a grown-up | 10 levels in 6 settings, a profile per child, sticker book, rescue practice | 1–2 + phones | Yes (new ES rescue lines pending review) | Kids | `inoa3d.js` | **Allergist review required** (`docs/audit-notes/safari.md`) |
| 5 | **Tide Runner** (`runner.html`) | 6+ | Runner: 5 zones, 3 styles, missions, coin-jar shop, daily seed, ghost | 1 | Yes | Action & Racing* | `inoa3d.js` | Real-phone feel |
| 6 | **Tide Lines** (`tidelines.html`) | 8+ | 4v4 paint battle: 3 arenas, Turf and Tide Pools modes, colour-blind cues | 1–8 (bots, phones) | Yes | Action & Fighting | `inoa3d.js` | Online mode on separate screens |
| 7 | **Perfect Fit** (`fit.html`) | All ages | 20 boxes in 4 rooms, colour matching, Zen mode | 1 | Yes | Cozy & Puzzle | `inoa3d.js` | Real-phone feel |
| 8 | **Junkyard to Jewel** (`junk.html`) | All ages | Restoration: 16 vehicles, designs, shop orders, photo cards | 1 | Yes | Cozy & Puzzle | `inoa3d.js` | Real-phone feel |
| 9 | **Brew and Bloom** (`brew.html`) | All ages | Idle café: levels 1–10, 16 teas, regulars and stories, journal, seasons | 1 | Yes (stories need a native read-through) | Cozy & Puzzle | `inoa3d.js` | Native ES review |
| 10 | **Driftwood Builders** (`builders.html`) | 8+ | Island sandbox: 3 islands, 21 quests, 7 unlockable pieces, islanders, postcards, share codes | 1 | Yes | Cozy & Puzzle | `inoa3d.js` | Real-phone feel |
| 11 | **Fail Tray** (`tray.html`) | All ages / party | 18 courses in 5 venues, slow-motion fail replay, Chill/Normal/Wild | 1–4 hot-seat + phones | Yes | Cards & Party | `inoa3d.js` | Real-phone feel |
| 12 | **Pact Trivia** (`trivia.html`) | 8+ / family | 473 fact-checked questions in 11 categories; Full show, Classic, Daily 10 | 1–4 + phone buzzers | Yes | Learn & Teach | `inoa3d.js` | Native ES review. Phone buzz latency |
| 13 | **Draw the Pact** (`draw.html`) | 6+ / party | Party, Teams, Telephone, Speed Sketch, Daily doodle, Guess the doodle; 704 words | 2–8 pass-and-play or phones | Yes | Cards & Party (tag: Learn) | `inoa3d.js` | Stylus hardware. Native ES words |

\* The proposed category list has no home for racing. Recommendation: rename "Action & Fighting" to **"Action & Racing"** (`docs/DECISIONS/0007-hub-categories.md`).

## 3. Platform features already built
Planning text sometimes lists these as future work. Each one exists today:

| Feature | Status | Where |
| --- | --- | --- |
| Shared hero profile (XP, coins, level), de-duplicated rewards | Live (local), synced when signed in | `engine/inoa3d.js` `results()`, `engine/platform.js` |
| Accounts (email + password), cloud profile, account deletion | Live: free beta, optional sign-in | Supabase project shared with Listing Studio (`ig_` objects only), `account.html`, `supabase/migrations/` |
| Server-side reward caps (per round and per day) | Live | `ig_finish_round` in `20261015000002_platform_functions.sql` |
| Admin dashboard (KPIs, feedback inbox, referrals) | Live, owner only | `admin.html`, `ig_admin_*` RPCs |
| Feedback from every game | Live | `engine/feedback.js`, `ig_feedback` |
| Invite links + referral credit ledger | Live (credit saved for later; nothing is charged) | `20261016000007_referrals.sql`, `terms.html#invite` |
| Billing (Stripe test mode) | Built, **switched off** (`BILLING_ENABLED` unset, `platform.json` `billing:false`) | `api/`, `pricing.html` |
| Phones as controllers, party rooms with QR codes, host approval | Live | `engine/net.js`, `engine/rtc.js` (Supabase Realtime + WebRTC), `pad.html` |
| Online multiplayer on separate screens | Island Drift only | `games/drift.html`, `docs/MULTIPLAYER.md` |
| PWA: installable, offline after first play | Live | `sw.js`, `manifest.webmanifest`, `test/pwa.js` |
| Native apps (iOS/Android) | Capacitor projects built, **not submitted** | `app/`, `store/`, `docs/APP_STORES.md` |

## 4. Saved data per game (device storage)
| Key | Owner | Scoped to the signed-in account? | Synced to the cloud? |
| --- | --- | --- | --- |
| `inoa.profile` / `inoa.profile.u.<id>` | Shared hero profile | Yes | XP, coins, achievements and per-game best/plays: yes |
| `inoa.drift`, `inoa.runner`, `inoa.tidelines`, `inoa.fit`, `inoa.junk`, `inoa.brew`, `inoa.builders`, `inoa.tray`, `inoa.trivia*`, `inoa.draw*`, `inoa.depths`, `snacksquad` (Safari, incl. each child's allergen profile), `pixelpact3.progress` | Each game's own save (unlocks, levels, shop, café, island…) | **No**: shared by everyone on the device | **No** |

See AUDIT Phase 0 finding F1 (P2): game-specific progress does not follow an account between devices, and is shared between users of one device.
