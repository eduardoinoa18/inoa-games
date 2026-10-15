# Inoa Games — scalability and cost plan

Status 2026-10-15. Numbers are planning estimates from public plan limits; re-check provider pricing before relying on them. No load was generated against production services (owner rule); capacity claims below are reasoned, not measured, except where a local test is cited.

## 1. Where the load goes
| Path | Who serves it | Scales how |
| --- | --- | --- |
| Hub, games, engine, packs (≈18 MB of shared, hashed assets) | Vercel static CDN (edge cache, `immutable` on `packs/assets/`) + the service worker after the first visit | CDN-scale; cost is bandwidth. A returning player re-downloads almost nothing |
| three.js r170 | jsDelivr (web) / vendored inside the native apps | Free CDN; native apps never fetch it |
| Gameplay itself | The player's device (all games are client-side) | Zero server cost per minute played |
| Accounts, starts, round results, feedback | Supabase (Auth + Postgres RPC) | ~3–6 small RPCs per play session (status, start, 1–3 finish_round). Every RPC is a single indexed statement or a short transaction |
| Billing (later) | 4 Vercel functions + Stripe | Only on checkout / portal / webhooks — tiny volume |

Gameplay never waits on the server: `finish_round` runs after the results card is shown, and offline rounds are queued.

## 2. Database hot spots and why they hold
- **Free-start limit**: one conditional upsert per start on `(user_id, usage_date)` — a row lock per player, never a global lock. Local test: 12 parallel starts for one player → exactly 1 succeeds (`test/db/concurrency.sh`).
- **Round results**: insert into `ig_session_rounds` (PK dedupe) + one update each on the player's profile, daily usage and progress rows — all keyed by the player.
- **Achievements**: the counts in `ig_check_achievements` scan the player's own rounds via `ig_session_rounds_user_created_idx`. At very high round counts per player (thousands), switch to counters on `ig_profiles` — noted, not needed for the beta.
- **Admin KPIs** aggregate `ig_events` / sessions over a time range using `(name, created_at)` and `(game_id, started_at)` indexes. Above roughly 1M events, add a nightly rollup table (or materialized view refreshed by `pg_cron`, which the project already has).
- **Feedback**: append-only, rate-limited per player (20/day) and globally for guests (300/hour).

## 3. Rough capacity by stage
| Stage | Players | Stack | Expected monthly cost |
| --- | --- | --- | --- |
| Beta (now) | up to ~1–2k testers, mostly guests | Vercel Hobby, Supabase Free (shared project), no Stripe | $0 hosting (+ $99/yr Apple, $25 once Google for the stores) |
| Soft launch | up to ~10k MAU, ~1k DAU | Vercel Pro, dedicated Supabase Pro, SMTP provider, Stripe live | ≈ $20 + $25 + SMTP free tier ≈ $45–60 |
| Growth | 50k+ MAU | Same + Supabase compute add-on, KPI rollups, CDN bandwidth watch | ≈ $100–300, driven mainly by bandwidth and DB compute |

Back-of-envelope for the soft-launch row: 1k DAU × ~5 RPCs/session × 2 sessions/day = 10k RPCs/day. That is far below what a small Postgres instance handles. Bandwidth: first visits ≈ 5–20 MB each (one game's pack plus the engine). 10k new players a month comes to ≈ 100–200 GB, which fits within Vercel Pro's included bandwidth (re-check).

Revenue side (from `docs/PLATFORM_EVOLUTION_AUDIT.md`): $4.99/month nets ≈ $4.51 after Stripe fees on the web, so ~10 subscribers cover the soft-launch stack. In-app purchases net less (15–30% store fee).

## 4. Known limits of the free tier (beta)
- **Supabase Free pauses after 7 days of inactivity.** The shared project also serves Listing Studio, which lowers the risk. Ask testers to play weekly, or move to Pro.
- **The built-in Auth email sender is heavily rate-limited.** Add SMTP before inviting more than a handful of testers who create accounts. Guests need no email.
- **Vercel Hobby is non-commercial.** It's fine while nothing is sold; move to Pro, or to Cloudflare Pages, before charging.
- **The database is shared with Listing Studio.** It's isolated by the `ig_` prefix and grants, but a heavy load on one app affects the other. Move to a dedicated project at soft launch.

## 5. Scaling levers, in order
1. Keep assets cacheable (hashed packs, service worker) — already done.
2. Batch offline/queued `finish_round` calls (already queued; batching is a small change).
3. Rollup tables for admin KPIs.
4. Dedicated Supabase project with compute add-on; read replicas are not needed for this write pattern.
5. Online multiplayer (roadmap item 7) would add real-time servers (Cloudflare Durable Objects). That is the first component that scales with play time rather than with sessions; it needs its own cost plan.
