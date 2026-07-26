# Project Magic 2.0 — Scope Boundaries

**Companion to:** [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md) · [`GROWTH_ENGINE.md`](./GROWTH_ENGINE.md)

Reframing the mission from "AI marketing platform" to "AI Growth Engine" is powerful precisely because it's broader — and broader missions are exactly the ones that invite scope creep. This document draws the line explicitly, so "it fits the Growth Engine vision" is never used to justify building an unrelated business tool.

---

## Core

Squarely inside the mission — understanding the business, its customers, its market, and its goals, in service of growth:

- Marketing intelligence and execution (existing: Marketing Director, recommendations, campaigns, experiments, publishing/approval)
- Business Brain (observations, learnings, preferences, decisions, outcomes)
- Free Marketing Snapshot and Guided Onboarding
- Connector Framework and Smart Uploads (as data-acquisition mechanisms for the Business Brain)
- Customer Voice analysis
- Market Radar and Seasonal Intelligence
- Business Pulse and Marketing Health
- Trust Model and management styles governing how autonomously the Growth Engine acts

## Adjacent

Related to growth, potentially valuable, but requires explicit product decision before building — not automatically in scope just because it "fits the vision":

- **Multi-location/agency console** — already flagged as future in [`../MAGIC_BLUEPRINT.md`](../MAGIC_BLUEPRINT.md); remains adjacent, not core, for 2.0
- **Sales/lead-conversion tooling beyond CRM connector read access** — reading CRM data to inform marketing (core) is different from becoming a sales pipeline tool (adjacent, requires its own decision)
- **Website-building/hosting** — the product analyzes and recommends changes to a website; becoming the website's host/builder is a materially different product surface
- **Paid media buying/management** — recommending and forecasting seasonal opportunity is core; directly managing ad spend and bidding is adjacent and carries financial-liability implications requiring separate review
- **Customer-facing chat/support tooling** — Customer Voice reads support conversations (core); becoming the support tool itself is adjacent

Adjacent features require a specific product decision, evaluated individually through [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md), before they move to a roadmap.

## Out of scope

Explicitly not part of the Growth Engine mission, regardless of how the five-question filter might be argued:

- **Payroll, HR, benefits administration** — a real small-business need, but not a growth-intelligence need; "understanding the business" does not extend to running its back office
- **Accounting/bookkeeping as a product** — Finance connectors read for pattern intelligence (core); becoming the business's books-of-record system is a different product category entirely
- **Legal services or compliance automation** — outside the mission; a business's legal needs are not a marketing/growth understanding problem
- **General-purpose CRM replacement** — reading CRM data (core) is not the same as building a full contact/pipeline/deal-management product
- **Point-of-sale or inventory management** — operational tooling, not growth intelligence
- **Anything requiring AJN to become the system of record for data unrelated to growth** — the Business Brain is an understanding layer that reads and synthesizes; it does not aspire to replace the operational systems businesses already run on

## The test for a boundary dispute

When a proposal sits ambiguously between Core and Adjacent, or Adjacent and Out of Scope, the deciding question is not "could this help the business" (almost anything could) — it's:

> **Does this deepen our understanding of the business, its customers, its market, or its goals — or does it make us responsible for operating a part of the business we were never asked to run?**

Understanding and recommending → in scope. Operating → out of scope, no matter how adjacent it feels. AJN Marketing reads the business's CRM to recommend better marketing; it does not become the CRM. It reads the business's finances to forecast seasonality; it does not become the accounting system. The Head of Marketing relationship (see [`MANIFESTO.md`](./MANIFESTO.md)) is specific — it is not "AJN runs your whole business."

## Revisiting boundaries

These boundaries are not permanent. A future, explicit product decision could move something from Out of Scope to Adjacent, or Adjacent to Core — but that requires a deliberate decision, documented and filtered through [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md), never an accumulation of individually-reasonable-sounding features that quietly cross the line.
