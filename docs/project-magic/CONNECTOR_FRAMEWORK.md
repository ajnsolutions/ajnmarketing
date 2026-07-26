# Project Magic 2.0 — Connector Framework

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`SMART_UPLOADS.md`](./SMART_UPLOADS.md)

The Connector Framework is how the Business Brain grows new senses over time without every new integration becoming a bespoke engineering effort. It's a category system plus a single contract every connector — existing or future — implements.

---

## Connector categories

| Category | Examples | What it teaches the Business Brain |
|---|---|---|
| **Digital Presence** | Website, Google Business Profile, social platforms | How the business presents itself publicly |
| **CRM** | Contact/lead management systems | Customer relationships, lead sources, pipeline patterns |
| **Scheduling** | Booking/appointment systems | Demand patterns, capacity, seasonality |
| **Finance** | Invoicing/payment systems | Revenue patterns, pricing, seasonality (aggregate signal only — see Privacy below) |
| **Communication** | Call tracking, messaging, email | Customer Voice source (see [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md)) |
| **Industry-Specific** | Vertical tools (e.g., practice-management software for a dental office, property-management software for a landscaper) | Domain-specific signal a generic category can't capture |
| **Future** | Whatever comes next | Explicitly designed for — see below |

**Existing today:** Google Business Profile (Digital Presence) is a fully-built, OAuth-based connector. Website analysis (Digital Presence) exists as a scan rather than an authenticated connector. Everything else in the table is net-new for 2.0.

## The connector contract

Every connector, regardless of category, implements the same lifecycle so the rest of the system (onboarding, the Business Brain, Business Pulse, admin ops) never needs to special-case a specific integration:

| Stage | Contract requirement |
|---|---|
| **Auth** | A clear, owner-understandable consent step — never a raw OAuth scope dump in customer-facing copy |
| **Sync** | Regular, predictable data pull into Business Brain observations, evidence-linked to this connector |
| **Health** | A connector-level status (connected / needs reauth / temporarily unavailable / disconnected) surfaced honestly — never silently treated as "fine" when it isn't (see [`../GUIDED_ONBOARDING_AND_SETUP.md`](../GUIDED_ONBOARDING_AND_SETUP.md)'s existing Google-connection-state model, which this generalizes) |
| **Revoke** | The owner can disconnect at any time; disconnection stops new sync and is reflected honestly in Business Brain freshness, without deleting historical learnings that don't depend on continued access |
| **Customer-safe errors** | Provider errors, tokens, and technical diagnostics never reach customer-facing copy — only admin/ops surfaces, exactly as today's boundary already works |

A connector that can't satisfy all five stages isn't ready to ship, regardless of how valuable its data would be.

## Designing for unlimited expansion

The category list above is not exhaustive by design — it's a **shape**, not a fixed catalog. Adding connector #20 should look identical in effort and risk profile to adding connector #3: implement the five-stage contract, register the category, done. No connector addition should require:

- Redesigning the Business Brain's data model (observations/learnings/preferences already accept any evidence-linked input)
- Redesigning onboarding (a new connector slots into the existing "recommended for your business type" logic — see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md))
- Redesigning Business Pulse or Marketing Health (new signal types compose into the existing health-state model — see [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md))

## Prioritization principle

Not every category needs every connector built immediately. Prioritize by [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md): which connector removes the most owner effort for the customer types we serve today (see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md))? Scheduling and Communication connectors for local businesses, and CRM connectors for digital businesses, are the highest-leverage near-term candidates — see [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md) Wave II.

## Privacy and trust boundary

Finance and CRM connectors in particular touch sensitive data. The framework's rule: **connect for pattern intelligence, never for surveillance.** A Finance connector informs "your busiest season is spring" — it does not surface individual transaction-level detail into any customer-facing UI, and it never becomes a channel for AJN to see more about the business's finances than is needed to serve the growth mission. This mirrors the existing rule that admin/service-role systems never leak secrets or raw provider payloads into customer or even admin UI (see [`../PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md`](../PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md)).
