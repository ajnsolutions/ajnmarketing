# Project Magic 2.0 — Master Blueprint

**Status:** Design constitution (non-code). Documentation, diagrams, and wireframes only — no application functionality changes.
**Companion folder:** [`docs/project-magic/`](./project-magic/) — every section below expands into its own document there.
**Builds on:** Project Magic 1.0's constitution — [`PROJECT_MAGIC_MANIFESTO.md`](./PROJECT_MAGIC_MANIFESTO.md), [`MAGIC_BLUEPRINT.md`](./MAGIC_BLUEPRINT.md), [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md), [`TRUST_MODEL.md`](./TRUST_MODEL.md), [`MARKETING_HEALTH.md`](./MARKETING_HEALTH.md), [`VOICE_AND_PERSONALITY.md`](./VOICE_AND_PERSONALITY.md), [`NAVIGATION_PHILOSOPHY.md`](./NAVIGATION_PHILOSOPHY.md), [`DASHBOARD_PHILOSOPHY.md`](./DASHBOARD_PHILOSOPHY.md), [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md). **This blueprint does not replace, contradict, or invalidate any of those documents.** They remain the authoritative record of what shipped through RC-1. This blueprint is what comes next.

This is not a technical spec. It is not marketing copy. It is a long-term design document — the constitution every future developer, designer, AI agent, and product owner should be able to point to when deciding what AJN Marketing becomes.

---

## Why this document exists

Project Magic 1.0 answered: *how do we make AI marketing feel like hiring a Head of Marketing instead of buying software?* That question is answered. The manifesto, trust model, Marketing Health signal, navigation philosophy, and a working implementation (Marketing Director, recommendations, campaigns, experiments, decision intelligence, strategic calendar, marketing memory, guided setup, assisted pilot) all exist and are validated through RC-1.

Project Magic 2.0 answers a bigger question: **what is AJN Marketing *for*, beyond marketing?**

The answer is in [`project-magic/GROWTH_ENGINE.md`](./project-magic/GROWTH_ENGINE.md):

> AJN Marketing is evolving from an AI marketing platform into an **AI Growth Engine** for small businesses. Marketing is the first application of that intelligence. Growth is the mission.

Everything in this blueprint exists to make that true without breaking what already works.

---

## How to read this blueprint

Start here, then follow the thread that matches your question:

| If you're asking... | Read |
|---|---|
| "Why does this product exist?" | [`MANIFESTO.md`](./project-magic/MANIFESTO.md) |
| "What are we not allowed to compromise on?" | [`PRODUCT_PRINCIPLES.md`](./project-magic/PRODUCT_PRINCIPLES.md) |
| "Should we build this feature?" | [`PRODUCT_DECISION_FILTER.md`](./project-magic/PRODUCT_DECISION_FILTER.md) |
| "Who are we building for?" | [`CUSTOMER_TYPES.md`](./project-magic/CUSTOMER_TYPES.md) |
| "What does the customer experience, end to end?" | [`CUSTOMER_JOURNEYS.md`](./project-magic/CUSTOMER_JOURNEYS.md) |
| "What's the very first thing a prospect sees?" | [`FREE_MARKETING_SNAPSHOT.md`](./project-magic/FREE_MARKETING_SNAPSHOT.md) |
| "Where does the intelligence live?" | [`BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md) |
| "What if a business has no connectable systems?" | [`SMART_UPLOADS.md`](./project-magic/SMART_UPLOADS.md) |
| "How do we plug in new data sources over time?" | [`CONNECTOR_FRAMEWORK.md`](./project-magic/CONNECTOR_FRAMEWORK.md) |
| "How do we understand what customers are actually saying?" | [`CUSTOMER_VOICE.md`](./project-magic/CUSTOMER_VOICE.md) |
| "How do we watch the competitive landscape?" | [`MARKET_RADAR.md`](./project-magic/MARKET_RADAR.md) |
| "How do we act before competitors do?" | [`SEASONAL_INTELLIGENCE.md`](./project-magic/SEASONAL_INTELLIGENCE.md) |
| "What does the owner actually look at?" | [`BUSINESS_PULSE.md`](./project-magic/BUSINESS_PULSE.md) |
| "What are the interaction rules for every screen?" | [`UX_RULES.md`](./project-magic/UX_RULES.md) |
| "What are we explicitly *not* building?" | [`SCOPE_BOUNDARIES.md`](./project-magic/SCOPE_BOUNDARIES.md) |
| "What are the screens and how do they connect?" | [`INFORMATION_ARCHITECTURE.md`](./project-magic/INFORMATION_ARCHITECTURE.md) |
| "What do the screens look like?" | [`WIREFRAMES.md`](./project-magic/WIREFRAMES.md) |
| "What order do we build this in?" | [`IMPLEMENTATION_ROADMAP.md`](./project-magic/IMPLEMENTATION_ROADMAP.md) |
| "What already exists vs. what's net-new?" | [`EXISTING_SYSTEM_AUDIT.md`](./project-magic/EXISTING_SYSTEM_AUDIT.md) |

---

## 1. Product vision

AJN Marketing is evolving from an AI marketing platform into an **AI Growth Engine** for small businesses.

**Mission:** Help businesses grow by understanding their business, their customers, their market, and their goals — better than they have time to understand it themselves.

Marketing is the first application of that intelligence, because it's where a small business owner's time-poverty is most acute and most visible. But the underlying asset AJN Marketing builds — a durable, structured understanding of a real business — is bigger than marketing. It is a **Business Brain** (see [`BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md)), and marketing is the first, not the only, thing it powers.

This reframing changes nothing about what ships next month. It changes everything about how every future decision gets made: not "does this help marketing?" but "does this deepen our understanding of the business, its customers, its market, or its goals — and does that understanding help the business grow?"

## 2. Product manifesto (summary)

Full text: [`MANIFESTO.md`](./project-magic/MANIFESTO.md).

> **You run your business. We'll help you grow it.**

The customer should feel like they hired a Head of Marketing. Not like they bought software. Project Magic 1.0 built that feeling for marketing specifically. Project Magic 2.0 extends the same promise — the same guide, the same calm, the same "I've got this" — to the wider job of growing the business, one connector, one data source, one insight at a time, without ever asking the owner to become a marketer, an analyst, or a systems administrator.

## 3. Product principles (summary)

Full list: [`PRODUCT_PRINCIPLES.md`](./project-magic/PRODUCT_PRINCIPLES.md).

**Principle Zero:** Complexity belongs to us. Simplicity belongs to the customer.

Every other principle — Guided Experience, Business Brain / Marketing Memory, Customer Voice, Market Radar, Seasonal Intelligence, Forecasting, Living Market Intelligence, Connector Framework, Business Goals, the Product Decision Filter, the Grandparent Test, the Five-Year-Old Test, One Question Per Screen, the 30-Second Rule — is a specific, enforceable expression of Principle Zero. None of them are aspirational language; each has a pass/fail test attached.

## 4. Product Decision Filter (summary)

Full document: [`PRODUCT_DECISION_FILTER.md`](./project-magic/PRODUCT_DECISION_FILTER.md).

Every feature proposal must answer **yes** to all five questions:

1. Does this make the product *easier*, not just more capable?
2. Does this help the business grow (revenue, customers, reputation, time back)?
3. Does AI automate meaningful work — not just display more data?
4. Is this easy for a non-technical owner, with zero training?
5. Does this fit the Growth Engine vision — not just the marketing vertical?

**If any answer is no: do not build it.** This is not a scoring rubric. It is a gate.

## 5. Customer types (summary)

Full document: [`CUSTOMER_TYPES.md`](./project-magic/CUSTOMER_TYPES.md).

| Type | Examples | Primary digital presence | Defining trait |
|---|---|---|---|
| **Local businesses** | HVAC, dentist, restaurant, attorney, landscaper | Website + Google Business Profile | Discovered by proximity; wins on trust, reviews, response time |
| **Digital businesses** | SaaS, consultants, agencies, courses, e-commerce | Website + owned channels | Discovered by content/search/referral; wins on authority and conversion |
| **Platform businesses** | AJN Sports Coaches | A hosted profile *inside* a platform AJN operates, not an independent website | Discovered *within* the platform; wins on profile completeness and platform-native signals |

Platform businesses are the newest and most structurally different case: their "website" is a profile page AJN itself hosts, so onboarding and the Business Brain must ingest platform-native data (bookings, profile views, platform messages) instead of assuming an independent domain to crawl.

## 6. Customer journey (summary)

Full document: [`CUSTOMER_JOURNEYS.md`](./project-magic/CUSTOMER_JOURNEYS.md).

```
Discovery → Free Marketing Snapshot → Signup → Guided Onboarding
   → Business Brain Creation → First Week → Weekly Cadence → Autopilot
```

This is the same shape as Project Magic 1.0's journey (Public → Signup → Onboarding → First login → First approval → Weekly → Autonomous → Long-term), extended backward (a real, personalized proof point *before* signup — the Free Marketing Snapshot) and reframed forward (Autopilot is the 2.0 name for the highest trust stage, "Trusted Head of Marketing," now scoped to the full Growth Engine rather than marketing alone).

## 7. Free Marketing Snapshot (summary)

Full document: [`FREE_MARKETING_SNAPSHOT.md`](./project-magic/FREE_MARKETING_SNAPSHOT.md).

Before a prospect creates an account, the AI scans what's public — website, Google Business Profile, social presence, public reviews, public business listings, and named competitors — and presents **"What Customers See"**: an honest, plain-English snapshot of how the business currently looks to the outside world. The prospect can approve, edit, comment on, or correct anything in it. That correction *is* the first onboarding step — the Snapshot and onboarding are the same flow, not two separate ones.

## 8. Business Brain (summary)

Full document: [`BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md).

The Business Brain is the durable, structured understanding AJN Marketing builds of a real business. It already exists in nascent form today as **Marketing Memory** (observations, learnings, preferences, decisions, outcomes — see [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md)) feeding the **Marketing Director**. 2.0 broadens both the input surface (connectors, uploads, Customer Voice, Market Radar, Seasonal Intelligence) and the output surface (not just marketing recommendations, but forecasts, Business Pulse, and eventually cross-domain growth actions) — without inventing a second decision engine. Marketing Director remains the sole decision-maker for marketing actions; the Business Brain is what it learns from.

## 9. Smart Uploads (summary)

Full document: [`SMART_UPLOADS.md`](./project-magic/SMART_UPLOADS.md).

When a connector doesn't exist yet, the owner can upload what they already have — PDFs, spreadsheets, documents, images, video, call transcripts, sales reports, customer lists, service catalogs — and the AI extracts what it can into the Business Brain. After every upload, the product says, in plain language, **"I learned..."** and names the specific intelligence gained. Never a silent ingestion; never a technical success toast.

## 10. Connector Framework (summary)

Full document: [`CONNECTOR_FRAMEWORK.md`](./project-magic/CONNECTOR_FRAMEWORK.md).

A named set of connector categories — Digital Presence, CRM, Scheduling, Finance, Communication, Industry-Specific, and an explicit Future category — each with the same contract (auth, sync, health, revoke, customer-safe error states) so adding the *next* connector is a configuration exercise, not a new subsystem. Designed for unlimited expansion from day one.

## 11. Customer Voice (summary)

Full document: [`CUSTOMER_VOICE.md`](./project-magic/CUSTOMER_VOICE.md).

Reviews, call intelligence, messages, emails, and support conversations are never just counted — they're read. The Business Brain extracts themes, sentiment, recurring questions, praise, objections, and competitor comparisons from actual customer language, and that extraction becomes evidence the Marketing Director and (eventually) the wider Growth Engine can cite.

## 12. Market Radar (summary)

Full document: [`MARKET_RADAR.md`](./project-magic/MARKET_RADAR.md).

Continuous, low-noise monitoring of competitors, market shifts, publicly available pricing/promotion signals, search trends, weather, seasonality, and industry change — with the owner in control of which competitors matter (add, remove, prioritize) and the option to benchmark an aspirational company that isn't a direct competitor at all.

## 13. Seasonal Intelligence (summary)

Full document: [`SEASONAL_INTELLIGENCE.md`](./project-magic/SEASONAL_INTELLIGENCE.md).

Uses prior years, competitor history, weather, search trends, campaign performance, and customer behavior to forecast opportunities and recommend acting *before* competitors do — always framed as an honest forecast with a confidence level, never a guarantee.

## 14. Business Pulse (summary)

Full document: [`BUSINESS_PULSE.md`](./project-magic/BUSINESS_PULSE.md).

The executive view, in three layers:

1. **Conversation** — the Head of Marketing briefing, in plain language.
2. **Marketing Health** — the existing red/yellow/green signal ([`MARKETING_HEALTH.md`](./MARKETING_HEALTH.md)), unchanged, still the primary results language for marketing specifically.
3. **Executive analytics** — Business Pulse itself: Marketing Health plus **Growth Momentum**, composed for owners who want the fuller picture, delivered weekly by email, monthly as a report, and readable on mobile.

Layer 1 is what most owners see most of the time. Layers 2 and 3 exist for the owner who wants to go deeper, never for the owner who doesn't.

## 15. UX rules (summary)

Full document: [`UX_RULES.md`](./project-magic/UX_RULES.md).

Conversation before dashboards. One question per screen. Simple language, no jargon. Progressive disclosure — power users can drill down; casual users never have to. These are inherited directly from Project Magic 1.0's design principles and apply, unchanged, to every 2.0 surface.

## 16. Scope boundaries (summary)

Full document: [`SCOPE_BOUNDARIES.md`](./project-magic/SCOPE_BOUNDARIES.md).

Explicit **Core / Adjacent / Out of Scope** classification exists specifically to prevent the mission expansion ("Growth Engine," not just "marketing tool") from becoming scope creep in the backlog. Growth Engine is a *lens for evaluating decisions* — it is not a license to build every adjacent business tool.

## 17. Information architecture & wireframes (summary)

Full documents: [`INFORMATION_ARCHITECTURE.md`](./project-magic/INFORMATION_ARCHITECTURE.md), [`WIREFRAMES.md`](./project-magic/WIREFRAMES.md).

Every screen mapped, every navigation relationship shown, with low-fidelity wireframes for the net-new surfaces (Free Marketing Snapshot, Business Brain view, Smart Uploads, Connector Framework hub, Market Radar, Business Pulse). Existing surfaces (Head of Marketing, Weekly Briefing, Approvals, Results, Settings, Setup) are referenced, not redrawn — see [`NAVIGATION_PHILOSOPHY.md`](./NAVIGATION_PHILOSOPHY.md) and [`DASHBOARD_PHILOSOPHY.md`](./DASHBOARD_PHILOSOPHY.md) for their existing, unmodified architecture.

## 18. Implementation roadmap (summary)

Full document: [`IMPLEMENTATION_ROADMAP.md`](./project-magic/IMPLEMENTATION_ROADMAP.md).

Four waves, prioritized by customer impact, each building on a fully-shipped predecessor:

| Wave | Theme | Depends on |
|---|---|---|
| **I** | Free Marketing Snapshot + Business Brain foundation | Existing website-analysis, business-profile, Marketing Memory |
| **II** | Connector Framework + Smart Uploads | Wave I data model |
| **III** | Customer Voice + Market Radar + Seasonal Intelligence | Wave II input pipeline |
| **IV** | Business Pulse + Autopilot (Growth Engine trust ceiling) | Waves I–III + existing Trust Model, still gated by `ATTACH_DECLARATIVE_PRODUCTION_CRONS` |

## 19. Existing system audit (summary)

Full document: [`EXISTING_SYSTEM_AUDIT.md`](./project-magic/EXISTING_SYSTEM_AUDIT.md).

A component-by-component audit of the current AJN Marketing implementation against the 2.0 vision, classifying every relevant subsystem as **Already Exists**, **Needs Redesign**, **Needs Expansion**, or **New Functionality**. This audit is the seed of the 2.0 implementation backlog.

---

## Standing constraints (carried forward, non-negotiable)

These are inherited from Project Magic 1.0 and RC-1 and are **not** open questions for 2.0:

- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` until an explicit, separately-approved change flips it.
- No silent auto-publish, no silent auto-approve.
- Tenant isolation (RLS + application-level `user_id`/`business_profile_id` checks) is never weakened.
- Marketing Director remains the sole marketing decision-maker — the Business Brain is what it learns from, not a second decision engine.
- Nothing in this blueprint authorizes any code change. This is a documentation-only sprint.

---

## Document map

| File | Role |
|---|---|
| `PROJECT_MAGIC_2_MASTER_BLUEPRINT.md` | This document — master index and constitution |
| `project-magic/MANIFESTO.md` | Why the product exists; the promise |
| `project-magic/PRODUCT_PRINCIPLES.md` | Principle Zero + all named principles and tests |
| `project-magic/PRODUCT_DECISION_FILTER.md` | The five-question build/no-build gate |
| `project-magic/CUSTOMER_TYPES.md` | Local, Digital, Platform business experiences |
| `project-magic/CUSTOMER_JOURNEYS.md` | Full lifecycle, stage by stage |
| `project-magic/FREE_MARKETING_SNAPSHOT.md` | Pre-signup proof experience |
| `project-magic/BUSINESS_BRAIN.md` | Central intelligence architecture |
| `project-magic/SMART_UPLOADS.md` | Flexible manual-input system |
| `project-magic/CONNECTOR_FRAMEWORK.md` | Connector categories and contract |
| `project-magic/CUSTOMER_VOICE.md` | Understanding, not counting, customer language |
| `project-magic/MARKET_RADAR.md` | Competitor and market monitoring |
| `project-magic/SEASONAL_INTELLIGENCE.md` | Forecasting and proactive timing |
| `project-magic/BUSINESS_PULSE.md` | Executive dashboard, three layers |
| `project-magic/UX_RULES.md` | Interaction rules for every screen |
| `project-magic/SCOPE_BOUNDARIES.md` | Core / Adjacent / Out of Scope |
| `project-magic/INFORMATION_ARCHITECTURE.md` | Screen map and navigation |
| `project-magic/WIREFRAMES.md` | Low-fidelity screen wireframes |
| `project-magic/IMPLEMENTATION_ROADMAP.md` | Delivery waves |
| `project-magic/GROWTH_ENGINE.md` | The capstone narrative — why Growth, not just Marketing |
| `project-magic/EXISTING_SYSTEM_AUDIT.md` | Current-system audit → 2.0 backlog seed |
