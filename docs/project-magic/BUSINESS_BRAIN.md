# Project Magic 2.0 — Business Brain

**Companion to:** [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md) · [`SMART_UPLOADS.md`](./SMART_UPLOADS.md) · [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) · [`MARKET_RADAR.md`](./MARKET_RADAR.md) · [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md) · [`GROWTH_ENGINE.md`](./GROWTH_ENGINE.md) · [`../MARKETING_MEMORY_ARCHITECTURE.md`](../MARKETING_MEMORY_ARCHITECTURE.md) (existing implementation this builds on)

The Business Brain is the single, durable, structured understanding of a real business that every AJN Marketing capability reads from and writes to. It is the technical and conceptual center of the Growth Engine — the thing that makes "we understand your business better than you have time to" true rather than aspirational.

**It is not a new engine.** It's the 2.0 name and expanded scope for what already exists as **Marketing Memory** (observations, learnings, preferences, decisions, outcomes — see [`../MARKETING_MEMORY_ARCHITECTURE.md`](../MARKETING_MEMORY_ARCHITECTURE.md) and [`../MARKETING_MEMORY_DATA_MODEL.md`](../MARKETING_MEMORY_DATA_MODEL.md)), broadened in input surface and output surface. Marketing Director remains the sole decision-maker; the Business Brain is what it — and, in future waves, other growth-decision surfaces — learns from.

**Shipped (AI Business Discovery — Wave I):** the first real composition layer over multiple sources into one explainable understanding, with an explicit Known/Assumed/Missing confidence vocabulary and a "raw observations" type (`BusinessDiscoveryObservation`) that maps directly onto this document's Observations layer. It composes read-only from existing tables — it does not yet write a new Business Brain record, and does not yet feed Marketing Memory's `learnings` layer. See [`../BUSINESS_DISCOVERY_ENGINE.md`](../BUSINESS_DISCOVERY_ENGINE.md) for the full architecture and its explicit mapping onto this document's four layers.

---

## Architecture at a glance

```
                         ┌─────────────────────────────┐
   INPUTS                │        BUSINESS BRAIN         │              OUTPUTS
                         │                              │
Website ────────────────▶│  Observations                │
Google Business Profile ─▶│  (raw facts, evidence-linked) │
Reviews ─────────────────▶│                              │──▶ Recommendations
Customer Voice ──────────▶│  Learnings                   │──▶ Campaigns
  (calls, messages) ─────▶│  (confidence-scored patterns) │──▶ Forecasts
CRM ─────────────────────▶│                              │──▶ Business Pulse
Booking systems ─────────▶│  Preferences                 │──▶ Marketing Health
Weather ─────────────────▶│  (owner-set, never inferred   │──▶ Weekly Reports
Search trends ────────────▶│   without confirmation)       │──▶ Autopilot actions
Competitors ──────────────▶│                              │
Seasonality ──────────────▶│  Decisions                   │
Smart Uploads ────────────▶│  (durable Marketing Director  │
  (PDFs, docs, images,     │   decision links)             │
   video, transcripts) ────▶│                              │
Future connectors ────────▶│  Outcomes                    │
Internal AJN systems ─────▶│  (did it work?)               │
                         └─────────────────────────────┘
```

## Inputs

| Input | Status | Notes |
|---|---|---|
| Website | Exists | Website-analysis pipeline (extraction, tone, keywords, SEO signals) |
| Google Business Profile | Exists | OAuth-connected, profile + posts + reviews |
| Reviews | Exists (counted) → Expands (understood) | See [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) |
| Customer Voice (calls, messages) | New | Requires Communication connector category — see [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md) |
| CRM | New | Connector category |
| Booking systems | New | Connector category |
| Weather | New | Feeds [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md) |
| Search trends | New | Feeds Seasonal Intelligence and Market Radar |
| Competitors | Exists (assisted-pilot manual) → Expands (continuous, owner-curated) | See [`MARKET_RADAR.md`](./MARKET_RADAR.md) |
| Seasonality | New (as a first-class model) | See [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md) |
| Uploads | New | See [`SMART_UPLOADS.md`](./SMART_UPLOADS.md) |
| Future connectors | Designed for, not yet built | See [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md) |
| Internal AJN systems | Exists | Marketing Director, recommendation pipeline, publishing/approval outcomes already feed Marketing Memory |

## Outputs

| Output | Status | Notes |
|---|---|---|
| Recommendations | Exists | Marketing Director's core output |
| Campaigns | Exists | Campaign Intelligence Engine |
| Forecasts | New | Seasonal Intelligence output, honestly confidence-scored |
| Business Pulse | New | See [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md) |
| Marketing Health | Exists | Unchanged — see [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md) |
| Weekly Reports | Exists | Weekly Briefing / Weekly Approval Package |
| Autopilot | New name, existing foundation | Top of Trust Model, broadened scope — see [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md#8-autopilot) |

## Layers (unchanged model, broadened content)

The four-layer Marketing Memory model already established stays exactly as designed — 2.0 does not add a second data model beside it:

1. **Observations** — raw, evidence-linked facts. A new observation type (e.g., "customer voice theme detected," "competitor price change detected," "seasonal pattern matched") is additive, not architectural change.
2. **Learnings** — confidence-scored patterns derived from repeated observations. Broader input sources mean richer learnings, not a new learning mechanism.
3. **Preferences** — owner-set or owner-confirmed. Never silently inferred and applied without confirmation, regardless of how confident the Business Brain is (this is a direct expression of Principle Zero — the customer's simplicity requires that surprises never come from silent preference inference).
4. **Decisions & Outcomes** — Marketing Director's durable decision trail and whether it worked. This is what makes Business Pulse's "Growth Momentum" signal honest rather than invented — see [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md).

## Non-negotiable architecture rules

- **One Business Brain per business, not one per feature.** Every capability (recommendations, campaigns, forecasts, Business Pulse) reads the same underlying structure. No feature gets a private data store that duplicates what the Business Brain already knows.
- **Marketing Director remains the sole marketing decision-maker.** The Business Brain is an evidence layer, not a second decision engine. This rule carries forward from [`../MARKETING_DIRECTOR_ARCHITECTURE.md`](../MARKETING_DIRECTOR_ARCHITECTURE.md) unchanged.
- **Every fact is evidence-linked.** No recommendation, forecast, or Pulse signal should trace back to "the AI just knows this" — it traces back to a specific observation, upload, or connector sync (see [`../DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md`](../DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md) for the existing explainability layer this extends).
- **Tenant isolation is absolute.** RLS + application-level ownership checks apply to every new input/output type exactly as they do today. A broader Business Brain is not an excuse to loosen isolation guarantees.
- **Nothing here activates schedules.** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` stays `false` regardless of how much the Business Brain knows — knowing more is not the same decision as acting more autonomously; that remains a separate, explicit trust-and-ops decision.

## What customers actually see

Almost none of this. The Business Brain is infrastructure — see [`UX_RULES.md`](./UX_RULES.md). What customers see is its *output*: a smarter recommendation, a more accurate Snapshot, a forecast that arrives before the season starts, a Weekly Briefing that references something they told us once and we never forgot. If a customer ever needs to understand "the Business Brain" as a concept to get value, the design has failed Principle Zero.
