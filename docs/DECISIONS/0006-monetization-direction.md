# 0006 — Monetization direction (needs the owner's decision)

**Status:** OPEN: two approved documents conflict.

| Source | Says |
| --- | --- |
| Platform evolution (approved 2026-10-15, Phases 7–14) | Free tier with 3 starts/day + **Premium subscription** (US$4.99/month, Stripe, test mode first). Built and switched off |
| Free-beta decision (owner, 2026-10-16) | Everything free during the beta; migrate to paid later |
| Referral decision (owner, 2026-10-16) | US$1 credit per verified referral **toward the monthly subscription** |
| v4 master plan (2026-10-17) | "Optional cosmetic monetization in the future, never paid power"; "do not introduce mandatory subscriptions or paywalls without explicit owner approval" |

**Today nothing is charged**: `platform.json` has `billing:false`, `BILLING_ENABLED` is unset, access mode is `beta_free`. So there is no urgency, but the referral terms promise credit toward a subscription.

## Options
1. **Keep Premium as designed** (daily-start limit for free accounts) after the beta. Simple and already built, but it is a soft paywall on gameplay.
2. **Premium as "supporter" with no gameplay limit:** unlimited play for everyone, and Premium gives cosmetics, extra hero colours, early access and cloud slots. This fits the v4 rule (no paywalls, no power) and the referral credit still applies. **Recommended.**
3. **Cosmetic store only** (one-off purchases). Needs a catalogue and store-billing rules in the native apps. Referral credit would need re-wording.

Owner decision needed before paid plans start. Whatever is chosen: no loot boxes, no purchasable currency for wagers, no ads to kids.
