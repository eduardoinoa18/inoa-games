# Inoa Games — roadmap (dependency order, 2026-10-17)

Replaces the calendar-style phase lists. Effort is a range for **one engineer with Claude Code**. Confidence: H/M/L. A release ships when its acceptance test passes. Releases are not tied to dates. The inventory is in `docs/PRODUCT_INVENTORY.md`, decisions in `docs/DECISIONS/`, findings in `docs/AUDIT.md`.

## Where we are
All 13 original games have had an elevation pass; Dominoes (game 14, the first Card Room game) shipped 2026-10-17. The platform (accounts, free beta, feedback, invites, admin, party rooms, PWA, Capacitor projects) is live or built. **The largest unknown is real devices**: no game has been played on a mid-range phone and measured, and phone-as-controller rooms over the live Realtime service are untested from here (the sandbox can't reach it).

## Releases
| # | Release | Depends on | Effort | Conf. | Acceptance test |
| --- | --- | --- | --- | --- | --- |
| **R0** | Phase 0: verified inventory, decisions, baseline, link previews | — | done in this pass | H | Docs match the repo. Baseline recorded in AUDIT. Every page has description + Open Graph tags |
| **R1** | **Real-device pass** (prep done 2026-10-17: `testers.html` bilingual tester guide linked from the hub's beta strip; feedback now records fps, quality drop and coarse device class, shown in the admin inbox): owner + 3–5 family testers play each game on their phones using a short checklist. In-game feedback collects device + FPS. Fix the top issues | R0 | 1 day of testing + 2–5 days of fixes | M | Every game reaches its first result screen on an iPhone and on a mid-range Android. Phone-as-controller works on a home Wi-Fi network. No P0/P1 left |
| R2 | ✅ **Done 2026-10-17** (the "Action & Racing" label still needs the owner's OK). Hub discovery: category chips (0007), search | — | done | H | Each game appears under exactly one category in EN/ES at 390×844 and 1000×560. Search finds games by name and tag. `test/index.js` covers it |
| R3 | ✅ **Done 2026-10-17.** **Account-scoped + cloud game saves** (F1): `E.save()/E.load()` engine API scoped to the active profile, plus an `ig_save_put/get` RPC (size-capped blob, version + updated_at, last-write-wins with a "newer save found" prompt). Migrate 13 games | R1 | 3–6 days | M | Sign in on device A, play Brew, sign in on device B → café restored. Two accounts on one device don't see each other's saves. Guest saves are offered for import once. DB tests for RLS isolation |
| R4 | i18n completeness check: a script extracts EN/ES pairs per page and fails CI on a missing ES string | — | 1–2 days | M | The script reports zero gaps, or a written allow-list |
| R5 | Ship-readiness basics: accessibility pass (focus order, labels, contrast) on the hub, account and one game per type; `docs/LAUNCH.md` | R1 | 2–3 days | M | axe-core run on the hub/account pages with no serious issues. Keyboard-only path to play every game |
| R6 | Flagship feasibility spike (0003) | R1 (real phone numbers) | 2–4 days | M | Spike answers its four questions with measurements. Go/no-go written in 0003 |
| R7 | Generic host-authoritative room helper (from Drift's online code) | — | 1–2 weeks | M | Drift online races run on the helper with no behaviour change. `test:party` green |
| R9 | 🟡 **Built 2026-10-17, play test pending.** Kids shell (`engine/kids.js` + `kids.css`) + **Bubble Pop Counting** (`games/bubbles.html`, 4 stages + Pop party, parent gate, EN/ES voice; `test/bubbles.js`). Left: the acceptance play test with a 4-year-old, native ES voice check (0005) | R1 | ~1 week | M | A 4-year-old tester finishes a round without help. Big text + voice EN/ES. Parent gate on settings |
| R8 | 🟡 **Local part done 2026-10-17.** Card Room core (`engine/cardroom.js`) + **Dominoes** (0004): full matches vs bots in EN/ES, pass-and-play privacy screen, phones as private hands, host rejects illegal moves (`test/dominoes_rules.js`, `test/dominoes.js`, `test/party_dominoes.js`). Left: online play on separate screens (needs R7), real-phone check | R7 for online; local/bots don't need it | 1–2 weeks | M | Full match vs 3 bots in EN/ES. The host rejects illegal moves. Phone hands stay private |
| R10 | Flagship town MVP | R6 = go | 2–4 weeks | L | Town → quest → dungeon → reward once → return → survives a reload. Depths still playable as before |
| R11 | App-store submission (free beta, no payments) | R1, R5; owner developer accounts (Apple US$99/yr, Google US$25 once); 0004 decision if casino games are in scope | 3–5 days + review time | M | TestFlight + Play internal-testing builds installed on real devices. Privacy labels match `docs/APP_STORES.md` |
| R12+ | More Card Room games, more kids' games, quick-play mini-games (🟢 **Memory Match built 2026-10-17**: `games/memory.html`, five modes incl. Little ones on the Kids World shell, Words EN/ES, Daily board; `test/memory.js`. Next: Stack Tower, Pest Patrol), online Tide Lines/Depths, flagship phases (homestead via 0002, wilds, crafting) | each its own record | — | L | Each gets its own acceptance test before it starts |

## Recommended next release
**R1 (real-device pass)**, then **R3 (account-scoped cloud game saves)**. R1 is the biggest risk and needs the owner's phones. R3 closes the largest product gap: game progress doesn't follow a player between devices. R2 (hub categories) shipped with Phase 0.

## Owner decisions that unblock work
1. 0001: keep Island Drift (recommended).
2. 0006: monetization direction after the beta.
3. 0004: whether Poker/Blackjack are in scope, and in which builds.
4. 0007: rename "Action & Fighting" → "Action & Racing".
5. Allergist review of Safari's medical wording (`docs/audit-notes/safari.md`) before any wider promotion of Safari.
6. Apple/Google developer accounts when ready for R11.

## Not doing (until a decision record promotes it)
Unity or any second engine; persistent online world; guilds; public leaderboards; chat of any kind; real-money anything; loot boxes; deleting or redirecting a game.
