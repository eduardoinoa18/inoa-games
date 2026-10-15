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
Secrets (Vercel environment variables only, never in the repo or browser): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `SITE_URL`, `STRIPE_LIVE_ENABLED` (must be `"yes"` for `sk_live_` keys to be used — a second lock against accidental live charges).

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
1. Supabase: create a project for Inoa Games (the org is on the Free plan with 2 active projects — pause one or upgrade), then run `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`). Auth → URL configuration: Site URL = production URL, redirect URLs = `<site>/account.html`. Auth → SMTP: add a production SMTP provider.
2. Put the project URL + anon key into `platform.json` and set `enabled: true`.
3. Stripe (test mode): create product "Inoa Games Premium", recurring price $4.99/month; add webhook endpoint `<site>/api/stripe-webhook` with events `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`; enable the customer portal.
4. Vercel: import the repo; set env vars from §3 (Preview + Production). Upgrade to Pro before charging real money (Hobby is non-commercial).
5. Sign up on the site with the owner email, verify it, run `supabase/admin/grant_owner.sql`, enable MFA.
6. Live billing: only after explicit approval — swap to live keys and set `STRIPE_LIVE_ENABLED=yes`.
