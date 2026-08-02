# Project Magic 2.0 — Market Radar

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md)

Market Radar is continuous, low-noise monitoring of everything happening around a business that it doesn't control but needs to know about. It replaces the current assisted-pilot's manual, admin-driven competitor tracking with an owner-facing, continuous, self-service model.

**Implementation status (2026-08-02):** the owner-managed persistence foundation for this doc's "Owner control" section has shipped — `supabase/migrations/037_market_radar.sql` and `lib/market-radar/` (types + tenant-scoped `*ForUser` functions) support add/remove/prioritize-competitor and benchmark tracking. This is persistence and types only, alongside the existing `lib/market-context/` signal pipeline (unmodified). The owner-facing Market Radar view described below is the next, already-queued phase.

---

## What it monitors

| Signal | What it tells the business |
|---|---|
| Competitors | What named competitors are doing publicly |
| Market shifts | Category-level changes (new entrants, category growth/decline signals) |
| Pricing changes (where publicly available) | Competitive pricing pressure or opportunity |
| Promotions | What competitors are currently pushing |
| Search | What's trending in the business's category and area |
| Weather | Near-term conditions relevant to weather-sensitive businesses |
| Seasonality | Recurring annual patterns — see [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md) for the forecasting layer built on top of this signal |
| Industry changes | Regulatory, technology, or category-wide shifts relevant to the business |
| New competitors | Newly-appeared businesses in the same category/area |

## Owner control

Market Radar is continuous by default but never fully automatic in what it watches — the owner stays in control of the competitive set:

- **Add a competitor** — name a specific business to track, beyond the default inferred set
- **Remove a competitor** — stop tracking one that isn't actually relevant
- **Prioritize competitors** — signal which ones matter most, so Market Radar surfaces their changes more prominently
- **Benchmark an aspirational company** — track a business that isn't a direct competitor at all, but represents where the owner wants their business to be (a bigger player in the category, a business in a different city doing something the owner admires) — tracked for inspiration and pattern-matching, not head-to-head comparison framing

## How it surfaces

Market Radar is a background process, not a screen the owner is expected to check. Its output reaches the owner through:

- **Weekly Briefing** — "a competitor just launched a spring promotion" folded into the existing weekly cadence, never a separate feed to monitor
- **Marketing Director recommendations** — a detected market shift becomes recommendation-relevant evidence, exactly like any other Business Brain input
- **Business Pulse** — aggregate competitive positioning as one input to Growth Momentum (see [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md))
- **A dedicated Market Radar view** — for the owner who *does* want to look, a simple, honestly-labeled list of tracked competitors and recent public changes, reachable via progressive disclosure (see [`UX_RULES.md`](./UX_RULES.md)), never forced into the primary dashboard

## Design rules

- **Public data only.** Market Radar never attempts to access a competitor's private systems, gated content, or anything requiring credentials that aren't the tracked business's own. "Publicly available" is a hard boundary, not a best-effort guideline.
- **No fabricated competitive claims.** If a pricing or promotion signal isn't genuinely publicly visible, Market Radar says nothing rather than guessing — this is a direct extension of the "no false success" discipline already enforced across the product (see [`../RC1_AUTHENTICATED_PILOT_VALIDATION.md`](../RC1_AUTHENTICATED_PILOT_VALIDATION.md)).
- **Freshness is always visible.** Any competitor/market data shown to the owner carries an honest "as of" signal — this is the Living Market Intelligence principle from [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) made concrete.
- **Calm framing, always.** A competitor doing well is information, not a threat alarm. Copy follows [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)'s messaging rules: one primary reason, one primary action, no urgency theater.

## Existing system note

The current assisted-pilot framework already performs manual, admin-triggered competitor tracking for owned pilot businesses (see [`../ASSISTED_PILOT.md`](../ASSISTED_PILOT.md)). Market Radar generalizes that capability into an owner-facing, continuous, self-service feature — it does not replace the admin/ops competitive visibility assisted-pilot operators use, which remains a separate, admin-scoped concern.
