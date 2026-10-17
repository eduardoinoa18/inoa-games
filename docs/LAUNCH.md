# Inoa Games — launch status (2026-10-17)

One page answering "what is ready, what is left, and what only the owner can do". Details live in the linked docs. Updated as items change.

## Ready (live at https://inoa-games.vercel.app, deployed from `main`)
| Area | State | Evidence |
| --- | --- | --- |
| 13 games, each with an elevation pass | Playable on touch, keyboard, gamepad and phones; EN/ES | `docs/AUDIT.md`. All 14 suites `NO_ERRORS` (Phase 0 + 2026-10-17 re-run) |
| Hub | Categories + search, Continue row, daily challenge, hero picker, link previews | `test/index.js` |
| Free beta | No sign-in needed. Optional accounts. Feedback from every game (with device/fps for tuning). Invite links | `test/beta.js`, `testers.html` |
| Accounts + cloud saves | Profile and game progress follow the player between devices; shared-device safe | `test/cloudsave.js`, `test/db` |
| Admin | KPIs, feedback inbox, referrals, user tools (owner only, audited) | `test/admin.js` |
| Phones as controllers | Rooms with QR + host approval; landscape gamepad on phones | `npm run test:party` (9/9) |
| Offline / install (PWA) | Works offline after first play | `test/pwa.js` |
| Quality gates | Spanish leak check `I18N_CLEAN`, accessibility scan `A11Y_CLEAN` (19 pages), Match feel budget | `test/i18n.js`, `test/a11y.js`, `test/pixelpact_perf.js` |

## Left before a wider launch (engineering)
1. **Real-device pass (R1)**: testers play on their phones with `testers.html`. Fix what the feedback inbox shows: fps, device and notes.
2. Native Spanish read-through of story text, trivia, draw words and the Safari rescue lines (a person, not a tool).
3. Store builds: TestFlight + Play internal testing once the developer accounts exist (`docs/APP_STORES.md`).
4. New games in progress: Dominoes (R8), Bubble Pop Counting (R9).

## Owner actions (cannot be done from code)
| # | Action | Where | Why |
| --- | --- | --- | --- |
| 1 | **Allergist review** of Safari's medical wording | `docs/audit-notes/safari.md` | Before promoting Safari to families |
| 2 | Decide: keep Island Drift; monetization direction; casino-style Card Room games; "Action & Racing" label | `docs/DECISIONS/README.md` | Unblocks the roadmap |
| 3 | Turn on **leaked-password protection** | Supabase dashboard → Authentication → Policies (flagged by the security advisor) | Stops reuse of breached passwords |
| 4 | Add an **SMTP provider** for auth email | Supabase → Authentication → SMTP | The built-in sender is heavily rate-limited; needed before many testers create accounts |
| 5 | Fill in the `[OWNER TO CONFIRM]` items: support email, COPPA approach, liability/governing law, retention periods, refund policy, taxes, referral-credit expiry | `privacy.html`, `terms.html` | Legal pages are drafts |
| 6 | Apple Developer (US$99/yr) and Google Play (US$25 once) accounts | `docs/APP_STORES.md` §1 | Store builds |
| 7 | Before charging anyone: Vercel Pro, Stripe live keys and explicit approval to switch billing on | `docs/PLATFORM_ARCHITECTURE.md` §11, §13 | Billing is off; Hobby plan is non-commercial |

## Not launching (by decision)
Unity or a second engine, public leaderboards, any chat, real-money anything, loot boxes, and removing or redirecting a game. See `docs/ROADMAP.md`.
