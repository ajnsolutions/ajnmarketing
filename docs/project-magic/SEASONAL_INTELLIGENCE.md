# Project Magic 2.0 — Seasonal Intelligence

**Companion to:** [`MARKET_RADAR.md`](./MARKET_RADAR.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md)

Seasonal Intelligence is the forecasting layer that turns "we noticed a pattern" into "act now, before the season starts, before competitors do." It's the clearest place where the Growth Engine mission (understanding the business better than it has time to) becomes a genuine time advantage rather than just a richer report.

---

## Inputs

| Input | What it contributes |
|---|---|
| Previous years | The business's own historical pattern — the strongest signal, when available |
| Competitor history | What worked for similar businesses in past seasons (from Market Radar's accumulated history) |
| Weather | Near-term and seasonal-normal conditions relevant to weather-sensitive demand |
| Search trends | Category-level demand signal, often the earliest indicator a season is starting |
| Campaign performance | What actually worked when this business tried something similar before |
| Customer behavior | Booking/inquiry/purchase timing patterns from connected systems |

## Output: a forecast, not a guarantee

Every Seasonal Intelligence output is a **forecast** — stated with a confidence level and an honest reasoning trail, never framed as a certainty:

> "Based on the last two springs, demand for AC tune-ups typically starts climbing in the next 2–3 weeks in your area. Worth getting ahead of it — want me to draft a spring tune-up promotion now?"

Not:

> ~~"Your AC business will see a 40% increase in demand starting March 15."~~

The first is honest, actionable, and still creates urgency where urgency is earned. The second fabricates precision the data doesn't support — a direct violation of the Forecasting principle in [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) and the "no false success" discipline established across the product (see [`../RC1_AUTHENTICATED_PILOT_VALIDATION.md`](../RC1_AUTHENTICATED_PILOT_VALIDATION.md)).

## "Recommend acting before competitors do"

This is the core value proposition of Seasonal Intelligence, and it has a specific design implication: forecasts must be surfaced with enough lead time to act, not just recorded as an interesting historical observation after the season has already started. A forecast delivered the week demand peaks is a report, not intelligence — it should arrive weeks earlier, when there's still time to prepare a campaign, adjust GBP posts, or update seasonal messaging.

When Market Radar shows a competitor already acting on a seasonal pattern, that's an escalation signal — the forecast becomes more urgent (still calmly framed, per [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)'s messaging rules) because the window to be first is closing.

## Where it feeds

- **Marketing Director** — a Seasonal Intelligence forecast becomes recommendation-relevant evidence, the same way any other Business Brain observation does; it does not bypass Marketing Director as a second recommendation source.
- **Weekly Briefing** — forecasts surface in the normal weekly cadence when their lead-time window opens, not as a separate alert channel.
- **Business Pulse** — an aggregate "are we ahead of or behind the season" signal contributes to Growth Momentum (see [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md)).

## Design rules

- **Confidence is always shown or implied honestly in the copy.** A forecast based on two years of the business's own data reads differently than one based on category-level search trends alone — the copy should reflect which it is, without requiring the owner to understand statistics to sense the difference (e.g., "based on your last two springs" vs. "based on what's typically true for businesses like yours").
- **A business with no history yet gets an honest, calibrated forecast, not a blank state.** Category-level and competitor-history signal can still produce a useful, appropriately-hedged forecast for a brand-new customer — this is important for customer types with limited platform tenure.
- **Never manufacture urgency.** A forecast's confidence and lead time drive its framing — not a desire to create engagement. If the pattern is weak, the copy says so plainly rather than being dressed up to sound actionable.
