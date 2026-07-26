# Project Magic 2.0 — Implementation Roadmap

**Companion to:** [`EXISTING_SYSTEM_AUDIT.md`](./EXISTING_SYSTEM_AUDIT.md) (this roadmap's evidence base) · [`../IMPLEMENTATION_ROADMAP.md`](../IMPLEMENTATION_ROADMAP.md) (1.0's Phase A–H roadmap, still in force for marketing-specific work)

**Constraint, unchanged:** No schedule activation. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` until explicit, separate ops approval. No silent auto-publish, no silent auto-approve. This blueprint authorizes no code — it is the plan for a future implementation sprint.

Prioritization rule: **highest customer impact first**, informed by the [`EXISTING_SYSTEM_AUDIT.md`](./EXISTING_SYSTEM_AUDIT.md) finding that Market Radar and Seasonal Intelligence have real foundations already, while the Free Marketing Snapshot's pre-auth experience does not.

---

## Wave I — Free Marketing Snapshot + Business Brain foundation

**Why first:** The Snapshot is the new front door — every other 2.0 capability compounds behind it, and it's the highest-leverage proof of the "You run your business. We'll help you grow it." promise a prospect will ever see. It also forces the Business Brain's input contract to be genuinely public-auth-optional from day one, which is easier to build in than retrofit later.

**Scope:**
- Public, pre-auth "What Customers See" experience (see [`FREE_MARKETING_SNAPSHOT.md`](./FREE_MARKETING_SNAPSHOT.md)) — reusing the existing website-analysis and AI Marketing Profile pipelines in a public-safe mode
- Session-to-account carryover into Signup and Guided Onboarding (no re-asking)
- Formalize the Business Brain as the explicit consumer of Marketing Memory's existing four-layer model — a naming/composition exercise, not a new data model
- Customer-type detection (local / digital / platform) informing onboarding step order (see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md))

**Depends on:** Existing website-analysis, business-profile, and AI Marketing Profile pipelines (Already Exists, per audit); existing Marketing Memory (Already Exists).

**Acceptance:** A prospect can see an honest, business-specific "What Customers See" without an account; approving/editing/commenting there means zero re-asked questions in onboarding; a platform-business prospect gets a profile-based equivalent, not a broken "enter your website" dead end.

**Shipped (AI Business Discovery — orchestration layer):** The composition engine behind the Snapshot — collects, normalizes, and explains an existing business's understanding (Known/Assumed/Missing) from website analysis, the AI Marketing Profile, Google Business Profile connection state, public reviews, and Market Context. Backend only, authenticated-session only (the public pre-auth entry point is explicitly Phase 2, see below). No UI, no new schema, no new decision engine. See [`../BUSINESS_DISCOVERY_ENGINE.md`](../BUSINESS_DISCOVERY_ENGINE.md).

**Shipped (Public Snapshot foundation):** The secure, pre-auth backend contract the Snapshot UI will call — SSRF-hardened URL/fetch validation (IP/hostname blocklist, DNS-resolution check, redirect revalidation, size/timeout caps), a versioned public request/response contract intentionally narrower than the authenticated one (drops Customer Perception and Competitive Position, which need reviews/Market Context this path never touches), an explicit public source allowlist enforced at the type and runtime level, rate limiting (5/hour/IP, reusing the existing interactive-demo limiter), a 15-minute TTL cache, and an unguessable, time-limited conversion-handoff reference. No account/tenant/database write of any kind. No landing page or results UI yet — see [`../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md).

**Still open in Wave I:** the landing page and results presentation UI; the actual signup-time conversion endpoint that resolves a snapshot reference; the approve/edit/comment/correct feedback loop that converts Assumed insights to Known; session-to-account carryover into Signup.

---

## Wave II — Connector Framework + Smart Uploads

**Why second:** Once the Snapshot proves the value of a richer Business Brain, the next-highest-impact step is making it easy to *keep* enriching it — for businesses whose important data isn't public. Formalizing the connector contract now (before building connector #2 and #3) avoids bespoke, one-off integration patterns.

**Scope:**
- Extract the reusable five-stage connector contract (auth/sync/health/revoke/customer-safe-errors) from the existing Google Business Profile implementation (see [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md))
- Build the first new connector category beyond Digital Presence — Scheduling or Communication, whichever has the clearest near-term customer demand at build time
- Smart Uploads: drop-zone → extraction → "I learned..." pipeline (see [`SMART_UPLOADS.md`](./SMART_UPLOADS.md))
- Connector hub UI (see [`WIREFRAMES.md`](./WIREFRAMES.md#connector-framework-hub))

**Depends on:** Wave I's Business Brain composition; existing GBP connector as the reference pattern (Already Exists, per audit).

**Acceptance:** A new connector category can be added by implementing the five-stage contract without touching the Business Brain's data model, onboarding flow, or Business Pulse composition; an upload produces a specific, honest "I learned..." statement, never a silent ingestion or a fabricated summary.

---

## Wave III — Customer Voice + Market Radar + Seasonal Intelligence

**Why third, and why these three together:** All three read from the richer input surface Wave II unlocks (connectors, uploads) and all three feed the same downstream consumer — Marketing Director's evidence base and, eventually, Business Pulse. Per the [`EXISTING_SYSTEM_AUDIT.md`](./EXISTING_SYSTEM_AUDIT.md), Market Radar and Seasonal Intelligence are **expansions of real existing foundations** (`lib/market-context/`, `lib/marketing-memory/seasonality.ts`), not new builds — this materially de-risks and likely shortens this wave relative to a naive estimate.

**Scope:**
- Customer Voice: theme/sentiment/objection extraction from reviews (expand existing review-reading), and from calls/messages once the relevant Wave II connector exists (see [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md)) — genuinely new intelligence, no existing foundation
- Market Radar: owner-facing add/remove/prioritize/benchmark controls over the existing `market-context` competitor provider (see [`MARKET_RADAR.md`](./MARKET_RADAR.md)) — expansion, not a rebuild
- Seasonal Intelligence: forward-looking, lead-time-aware forecast output built on top of the existing `seasonality.ts` recurrence classification (see [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md)) — expansion, not a rebuild
- Owner-facing Market Radar view (see [`WIREFRAMES.md`](./WIREFRAMES.md#market-radar))

**Depends on:** Wave II connectors for the Communication category (Customer Voice depth); existing `market-context` and `seasonality.ts` foundations (Already Exists, per audit).

**Acceptance:** A forecast reaches the owner with enough lead time to act before the season starts; a competitor change surfaces within a reasonable cycle without the owner checking manually; a Customer Voice insight could not have been produced by a `COUNT()` and an `AVG()` (see [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) test).

---

## Wave IV — Business Pulse + Autopilot (Growth Engine trust ceiling)

**Why last:** Business Pulse's Growth Momentum signal needs real signal from Waves I–III to be honest rather than padded with assumptions (per [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md)'s explicit rule against that). Autopilot's broadened scope is the highest-trust, highest-risk capability in this blueprint and should only follow proven signal quality — exactly the same sequencing discipline 1.0 already applied (Trust progression only after D/E delivered real data — see [`../IMPLEMENTATION_ROADMAP.md`](../IMPLEMENTATION_ROADMAP.md) Phase G).

**Scope:**
- Growth Momentum composition from Marketing Health + Customer Voice + Market Radar + Seasonal Intelligence outputs (see [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md))
- Monthly Business Pulse report, composing the already-built-but-unsurfaced Monthly Executive Briefing type (per [`EXISTING_SYSTEM_AUDIT.md`](./EXISTING_SYSTEM_AUDIT.md))
- Broaden Trust Model gating surface from marketing-only to Growth-Engine-wide, without loosening any existing safety rule
- Autopilot naming/framing at the top of the existing trust ceiling (see [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md#8-autopilot))

**Depends on:** Waves I–III shipped with real production signal; existing Trust Model design (Already Exists, per audit); explicit, separate ops approval for any schedule-activation-adjacent work — this wave does **not** itself flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS`.

**Acceptance:** Growth Momentum never shows a confident state built on missing signal; a business with sparse connections gets an honestly narrower Pulse, not a padded one; no trust promotion happens silently — every promotion is visible and reversible, exactly as 1.0's Trust Model already requires.

---

## Cross-cutting rules (every wave)

Carried forward from [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md), [`SCOPE_BOUNDARIES.md`](./SCOPE_BOUNDARIES.md), and [`UX_RULES.md`](./UX_RULES.md), enforced in review at every wave:

- Every feature passes [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md) before it's scoped, not after
- No feature crosses into [`SCOPE_BOUNDARIES.md`](./SCOPE_BOUNDARIES.md)'s Out of Scope list regardless of how "growth-adjacent" it sounds
- Marketing Director remains the sole marketing decision-maker throughout — no wave introduces a second, competing decision engine
- Tenant isolation, admin/customer boundary, and the cron gate are inherited unchanged in every wave
- No wave activates a production schedule; that remains a separate, explicit, ops-approved decision independent of this roadmap

## What this roadmap does not do

- It does not implement anything — this is a planning document from a documentation-only sprint
- It does not assign dates or team sizing — those are execution-time decisions outside this blueprint's scope
- It does not modify [`../IMPLEMENTATION_ROADMAP.md`](../IMPLEMENTATION_ROADMAP.md) (1.0's Phase A–H roadmap), which continues to govern marketing-specific delivery in parallel with this Growth Engine roadmap
