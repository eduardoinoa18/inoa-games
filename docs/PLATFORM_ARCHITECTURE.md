# Inoa Games platform architecture (decision record)

Status: **decided for the first account-based release**, 2026-10-15. Re-check provider prices/limits before launch (see `docs/PLATFORM_EVOLUTION_AUDIT.md` §12).

## 1. Decision
| Layer | Choice | Why |
| --- | --- | --- |
| Games, hub, admin UI | Existing static site on **Vercel** (`index.html`, `games/*`, `account.html`, `pricing.html`, `admin.html`) | Keeps the working engine and deploy flow; no rewrite |
| Accounts | **Supabase Auth** (email + password, email verification, password reset, sessions) | Managed, verified flows, rate limits, MFA available for the owner; no custom crypto |
| Data + authorization | **Supabase Postgres** with **Row Level Security** and `SECURITY DEFINER` SQL functions (RPC) | One database; authorization lives next to the data; atomic counters; no always-on server |
| Server code with secrets | **4 Vercel serverless functions** in `api/` (Stripe checkout, billing portal, webhook, account deletion) | Only places that need the Stripe secret or Supabase service key |
| Payments | **Stripe** Checkout + Billing portal + webhooks, **test mode** until the owner approves | Hosted pages (no card data touches us), standard subscription lifecycle |
| Analytics | First-party `events` table written by the RPCs + aggregate admin RPCs | No third-party tracker, no duplicate counting |

Rejected / deferred: custom auth server (unneeded risk), Supabase Edge Functions for Stripe (would add a second function runtime next to Vercel; revisit if we leave Vercel), Firebase (no SQL/RLS, harder KPIs), Cloudflare Workers + D1 (good and cheap — documented as the fallback host if Vercel Pro's cost matters: Pages allows commercial use on the free tier), third-party analytics (privacy + cost; first-party events cover the KPIs).

Client library: `@supabase/supabase-js@2` loaded **from jsDelivr** (`+esm`) — satisfies the "scripts only from jsDelivr" rule. It is imported lazily, only when the platform is enabled, so games stay as light as today.

## 2. Repository layout (new)
```
platform.json                 public config: {enabled, supabaseUrl, supabaseAnonKey, stripeMode, freeDailyStarts}
engine/platform.js            client platform layer (session, entitlement, start gate, finish round, sync, offline queue)
account.html  pricing.html  admin.html
api/_lib.js                   shared helpers (Supabase REST with service key, Stripe REST, signature check, JSON responses)
api/checkout.js  api/portal.js  api/stripe-webhook.js  api/account-delete.js
supabase/migrations/*.sql     versioned schema, RLS, functions (apply with the Supabase CLI or SQL editor, in order)
supabase/admin/grant_owner.sql   owner bootstrap (run by the owner in the Supabase SQL editor)
test/db/                      local Postgres harness: Supabase auth shim + SQL tests (RLS, limits, rewards, webhooks, admin)
```

## 3. Environments and configuration
| | Local / CI tests | Preview | Production |
| --- | --- | --- | --- |
| Static site | `npm start` / test harness | Vercel preview URL | Vercel production |
| Platform | `platform.json` `enabled:false` (games behave exactly as before) or the test adapter | Supabase **dev** project, Stripe **test** keys | Supabase **prod** project, Stripe test keys until launch approval, then live keys |
| Secrets | none | Vercel env (Preview) | Vercel env (Production) |

Public values (safe in `platform.json`): Supabase project URL, Supabase **anon/publishable** key (designed to be public; RLS protects data), Stripe mode label.
Server config (Vercel environment variables): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public, used to validate tokens). Secrets (Vercel environment variables only, never in the repo or browser): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `SITE_URL`, `STRIPE_LIVE_ENABLED` (must be `"yes"` for `sk_live_` keys to be used — a second lock against accidental live charges).

## 4. Data model (see `supabase/migrations/`)
| Table | Purpose | Client access (RLS) |
| --- | --- | --- |
| `profiles` | display name, hero, language, public flag, XP, coins | read own; update only `display_name`, `hero`, `lang`, `public_profile` (column grants) |
| `user_roles` | `admin` role | none (read via `is_admin()` only) |
| `account_status` | suspension flag + reason | read own |
| `customers` | user ↔ Stripe customer id | none |
| `subscriptions` | Stripe subscription mirror (status, period end, cancel flag, last event time) | read own |
| `game_catalog` | game id, name, access tier, active, order | read all |
| `game_progress` | per user+game best, plays, rounds, last played | read own |
| `game_sessions` | one row per qualifying start (client key, access type, expiry) | read own |
| `session_rounds` | one row per rewarded round (dedupe) | none |
| `daily_usage` | starts used per user per UTC date | read own |
| `achievements`, `user_achievements` | catalog + earned | catalog read all; earned read own |
| `events` | first-party analytics events | none |
| `admin_audit_logs`, `payment_webhook_events`, `app_config` | audit, webhook idempotency, tunables | none |

All writes to progression, usage, subscriptions, roles and status go through `SECURITY DEFINER` functions with `set search_path = public` that take the user from `auth.uid()` — never from a parameter.

## 5. Free tier: the "qualifying game start"
- A **start** is created when a signed-in, email-verified player presses **Play** on a game's title screen (assets are already loaded, so failed loads never consume a start). Opening the hub, a game page or a title screen consumes nothing.
- A start opens a **play session** valid for **30 minutes** (`app_config.session_minutes`). Replays of the same game inside that window are free; after it, the next round asks for a new start.
- Each page load sends a random `client_key` kept in `sessionStorage`; `start_game(game, client_key)` returns the existing unexpired session for the same key instead of charging again (reload/retry/double-click safe).
- Allowance: **3 starts per UTC calendar day** (`app_config.free_daily_starts`). The date comes from the database clock (`now() at time zone 'utc'`), never the browser. The hub shows starts left and the local time of the next UTC midnight.
- Enforcement is one atomic statement: `insert … on conflict (user_id, usage_date) do update set starts = starts + 1 where daily_usage.starts < limit returning starts`. Parallel requests cannot both take the last slot (row lock); tested with concurrent sessions.
- Premium (and the owner) create sessions with `access_type = 'premium'/'admin'` and no counter.
- Guests (not signed in) can still open every game's title screen and settings; Play asks them to sign in (free) once the platform is enabled. No anonymous play counter exists to bypass.

## 6. Premium entitlement
`entitled(user)` = active admin role, or a `subscriptions` row with `status in ('active','trialing')` and `current_period_end > now()`, or `status = 'past_due'` with `current_period_end > now()` (Stripe keeps retrying during the period already paid for; no extra grace period is invented). `canceled`/`unpaid`/`incomplete_expired` → free. A suspended account cannot start games at all. One SQL function (`entitlement()`) is used by `start_game`, `my_status` and the admin views.

## 7. Progression and rewards
- `finish_round(session, round_key, score, best_lower, xp, coins)` — session must belong to the caller, be at most 10 minutes past expiry, and have started at least 10 s earlier; the `(session, round_key)` pair is unique (replays get new keys; retries of the same round are no-ops). Rewards are clamped per round (XP ≤ 400, coins ≤ 150) and per UTC day (XP ≤ 4000, coins ≤ 1500). Best score is kept per game with `best_lower` (times). Returns the authoritative totals, which the client writes back to its local profile cache.
- Local progress import: once per account (`profiles.imported_local`), capped at 5000 XP / 2000 coins and per-game plays ≤ 500 — preserves real players' history without making unlimited client values authoritative. Logged as an event.
- Payment status never affects XP/coins rates (no pay-to-win).

## 8. Offline policy
- Cached single-player games stay playable offline. A start cannot be created offline, so: premium players with a **cached entitlement less than 72 h old** may play offline; free players may play offline with their remaining starts counted locally and **reconciled when back online** (the server is authoritative; if the server says the allowance was already used, the offline rounds earn no rewards). Offline rounds are queued (`localStorage['inoa.queue']`) and replayed through `finish_round` with their original round keys; anything rejected is dropped and the UI says so.
- Registration, login, password reset, checkout and admin need a connection and say so.

## 9. Owner / master admin
- Role lives in `user_roles` (no client access). Granted by `supabase/admin/grant_owner.sql`, which the owner runs in the Supabase SQL editor (dashboard login + MFA protect it) after signing up normally on the site. The script takes the owner's email, refuses unverified accounts, and writes an audit row. No password, email or key is stored in the repo or the browser.
- Every admin RPC starts with `if not is_admin() then raise exception 'forbidden'`. Admin UI navigation is shown only when `my_status().is_admin` is true, but hiding it is cosmetic — the database refuses non-admins.
- Recovery: password reset by email; if the email account is lost, the owner (as Supabase project owner) can re-run the grant script for a new account and revoke the old one (`revoke_owner.sql`). No backdoor exists.
- Recommend enabling MFA (TOTP) for the owner in Supabase Auth.

## 9b. Children and accounts
Accounts require ticking "13 or older, or a parent/guardian creating this account". Children under 13 can play everything as guests (no data leaves the device). **COPPA review by counsel is required before launch** (`privacy.html` is a draft with [OWNER TO CONFIRM] items).

## 10. KPI definitions (admin dashboard)
- **Registered users**: rows in `auth.users`. **Verified**: `email_confirmed_at is not null`.
- **Active user (DAU/WAU/MAU)**: distinct users with ≥1 `game_started` event in the last 1/7/30 days (hub visits are not activity).
- **Premium (active)**: entitled subscriptions now (§6). **Canceling**: active with `cancel_at_period_end`. **Past due**: `status = 'past_due'`.
- **Estimated MRR**: active premium subscriptions × $4.99 (label: estimate, not cash). **ARR estimate**: MRR × 12.
- **Gross receipts / refunds**: sums of `invoice.paid` and `charge.refunded` amounts recorded from webhooks in the period. **Net receipts** = gross − refunds (Stripe fees are not available from these events; labelled "before Stripe fees").
- **Conversion**: users whose first premium activation falls in the period ÷ users registered in the period. **Churn (30 d)**: subscriptions that ended in the last 30 days ÷ active at the start of the window.
- **Game starts / completed rounds / unique players / completion rate** (= rounds ÷ starts) per game from `game_sessions` and `session_rounds`.
- **Free-limit hits**: `start_denied` events with reason `limit`.

## 11. Owner setup checklist (external — cannot be done from code)
1. Supabase: ✅ **done 2026-10-15** — migrations `ig_platform_core`, `ig_platform_functions`, `ig_owner_bootstrap`, `ig_account_deletion` applied to the shared WebDesigns/Presentations project (§12); Listing Studio grants verified unchanged. Owner still to do: Auth → URL configuration: add `<inoa site>/account.html` to the redirect URLs (keep Listing Studio's Site URL/redirects); Auth → SMTP: add a production SMTP provider (the built-in sender is rate-limited); Auth → enable leaked-password protection (advisor warning).
2. ✅ Project URL + publishable key are in `platform.json`. Set `enabled: true` when steps 1, 3 and 4 are done (turning it on makes Play require a free account).
3. Stripe (test mode): create product "Inoa Games Premium", recurring price $4.99/month; add webhook endpoint `<site>/api/stripe-webhook` with events `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`; enable the customer portal.
4. Vercel: import the repo; set env vars from §3 (Preview + Production). Upgrade to Pro before charging real money (Hobby is non-commercial).
5. Sign up on the site with the owner email, verify it, run `supabase/admin/grant_owner.sql`, enable MFA.
6. Live billing: only after explicit approval — swap to live keys and set `STRIPE_LIVE_ENABLED=yes`.

## 12. Shared Supabase project (current setup)
For now Inoa Games runs in the owner's existing **WebDesigns / Presentations** Supabase project (`bqmmgtylygxwyjyyyxim`), which also hosts Listing Studio (`la_*` tables/functions). Never the `viventa-rd` project. To coexist safely:
- Every Inoa table, function, trigger and index is prefixed **`ig_`**; privilege revokes loop over `ig_*` objects only (no schema-wide `revoke … on all tables/functions in schema public`), so Listing Studio's grants are untouched.
- `auth.users` is shared: the sign-up trigger creates an Inoa profile only when the sign-up metadata has `app = 'inoa'` (sent by `engine/platform.js`). Someone who already has a Listing Studio login and signs in to Inoa gets a profile lazily (`ig_ensure_profile`, called by `ig_my_status` / `ig_start_game`).
- Admin KPIs and the user list count **Inoa accounts only** (joined to `ig_profiles`), not every login in the project.
- Consequences the owner should know: the same email/password works in both apps; Auth email templates, Site URL, redirect allow-list, SMTP and rate limits are shared (add `<inoa site>/account.html` to the redirect URLs; generic email wording); `ig_user_roles` admin is separate from Listing Studio roles. Moving to a dedicated project later = run the same migrations there and switch `platform.json` (accounts would need to re-register or be exported).

## 13. Free beta now, paid later (owner decision 2026-10-15)
"Put everything into a free tier for now to test, get feedback, try with some people; when ready to scale commercially, migrate to paid."

**What "free beta" means in the code (shipped default)**
| Switch | Beta (now) | Commercial (later) |
| --- | --- | --- |
| `ig_app_config.access_mode` (server, authoritative) | `beta_free` → every signed-in player is plan `beta`: all games, no daily counter | `commercial` → free tier (3 starts / UTC day) + Premium |
| `platform.json` `mode` / `guestPlay` | `beta` / `true` → guests play without an account (progress on the device) | `commercial` / `false` → Play asks for a free account |
| `platform.json` `billing` | `false` → no upgrade buttons, pricing page says "free during the beta", gate never links to pricing | `true` (web only — never inside the native apps) |
| Vercel env `BILLING_ENABLED` | unset → `/api/checkout` refuses (503) | `yes` + Stripe keys (test first, live only with owner approval + `STRIPE_LIVE_ENABLED=yes`) |
| Feedback (`ig_feedback`, 💬 in every game's settings + results card + hub strip) | on — guests and players; owner reads it in `admin.html` | keep on |

All commercial code paths (limit, Stripe checkout/webhooks/portal, entitlement) stay in place and tested (`npm run test:db`, `test:api`, `test:platform` run in commercial mode; `test:beta` runs the beta default).

**Free-tier stack and its limits (re-check before relying on them)**
| Service | Plan now | Cost | Limits that matter for a beta |
| --- | --- | --- | --- |
| Vercel | Hobby | $0 | non-commercial use only (fine while nothing is sold); generous bandwidth for a small beta |
| Supabase | Free, shared WebDesigns/Presentations project | $0 | 500 MB database, 50k monthly active users, built-in email sender heavily rate-limited (add SMTP — e.g. a free tier of Resend/Brevo — before inviting many testers), paused after 7 days without activity |
| Stripe | not used | $0 | — |
| Apple Developer Program | needed for TestFlight / App Store | $99 / year | TestFlight: up to 10,000 external testers (first build needs a light review) |
| Google Play Console | needed for Play testing | $25 once | new personal accounts: closed test with ≥ 12 opted-in testers for 14 days before production |

**Migration checklist when going commercial**
1. Dedicated Supabase project on Pro (no pausing, backups, custom SMTP): run the same `supabase/migrations/*` there; move accounts (Supabase supports user export/import; or ask beta testers to re-register — decide then).
2. Hosting: Vercel Pro (commercial use) — or Cloudflare Pages (commercial use allowed on free).
3. Payments: web → Stripe (already built). Native apps → in-app purchase (Apple/Google take 15–30%; a service like RevenueCat can unify entitlements) or the store's external-purchase rules where allowed — see docs/APP_STORES.md. Map store purchases into `ig_subscriptions` (provider column already exists).
4. Flip the switches in the table above; announce to beta testers (e.g. founders' perk via `ig_admin_grant_premium`).
5. Legal: counsel review of privacy policy, terms, COPPA / Google Families before targeting children.


## 14. Sharing and referrals (owner decision 2026-10-15)
- **Share** (📣 on the hub strip and the account page): native share sheet, else copy. Signed-in players share their invite link `…/index.html?ref=CODE`; guests share the plain link.
- **Referral credit**: a visitor who arrives via `?ref=CODE` (remembered 30 days in `localStorage['inoa.ref']`) and then signs up is attributed to the inviter (`ig_referrals`, pending). When the new account **confirms its email**, the inviter gets **$1** (`referral_credit_cents`) in `ig_credit_ledger`, up to **5 per UTC month** (`referral_monthly_cap`; extra ones are recorded as `capped`, unpaid). One referral per new account; self-referral impossible; codes are 6 characters without look-alikes.
- Credits are a **promise toward Premium**, not cash. During the free beta they accumulate; when paid plans launch they are applied as a Stripe customer-balance credit (web) or an equivalent store mechanism (apps) and recorded as `applied_to_subscription` ledger rows. Terms must state: no cash value, can't be transferred, may be revoked for abuse (fake/disposable accounts). **[OWNER TO CONFIRM in terms.html]**
- Owner view: referral tiles on `admin.html` (sign-ups, credited, over cap, waiting for email, credit outstanding).
