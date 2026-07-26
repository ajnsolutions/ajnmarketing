# Project Magic 2.0 — Customer Journey

**Companion to:** [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md) · [`FREE_MARKETING_SNAPSHOT.md`](./FREE_MARKETING_SNAPSHOT.md) · [`../CUSTOMER_JOURNEYS.md`](../CUSTOMER_JOURNEYS.md) (1.0 — detailed persona tables and magic-moments catalog, still authoritative and not repeated here)

This document maps the full lifecycle at the Growth Engine level. It extends 1.0's journey (Public → Signup → Onboarding → First login → First approval → Weekly → Autonomous → Long-term) by naming a proof-first entry point and reframing the trust ceiling around growth rather than marketing alone.

```
Discovery → Free Marketing Snapshot → Signup → Guided Onboarding
   → Business Brain Creation → First Week → Weekly Cadence → Autopilot
```

For each stage: **what the customer sees**, **what the AI is doing**, **what data is collected**, and **what remains invisible.**

---

## 1. Discovery

**What the customer sees:** A public site or platform listing that promises one thing — "You run your business. We'll help you grow it." — proven, not asserted, by an offer to show them their own business right now.

**What the AI is doing:** Nothing yet. No data collection happens before the prospect provides a business name/URL and consents to a scan.

**Data collected:** None until the Snapshot is requested.

**Invisible:** Everything about the Business Brain, connectors, and intelligence architecture. At this stage the product is a promise and a proof offer — nothing more.

---

## 2. Free Marketing Snapshot

See [`FREE_MARKETING_SNAPSHOT.md`](./FREE_MARKETING_SNAPSHOT.md) for the full design.

**What the customer sees:** "What Customers See" — an honest, plain-English read of how their business currently looks from the outside (website, Google Business Profile, social, reviews, public listings, and how they compare to a couple of named competitors). Every claim is editable: approve, correct, comment.

**What the AI is doing:** Scanning public sources only — no login, no connector auth required yet. Building the first draft of the Business Brain from public signal alone.

**Data collected:** Public website content, public GBP data, public reviews, public social presence, public competitor data — all sourced without requiring the business to authenticate anything.

**Invisible:** The scoring/extraction pipeline, confidence levels behind each finding, and the competitor-selection logic (a reasonable default set, refinable later in Market Radar).

---

## 3. Signup

**What the customer sees:** A short, calm account creation step that preserves everything they just corrected in the Snapshot — nothing is lost, nothing is re-asked.

**What the AI is doing:** Converting the anonymous Snapshot session into an authenticated Business Brain record.

**Data collected:** Account credentials only. No new business data — the Snapshot's corrections carry forward.

**Invisible:** The session-to-account migration and any anti-abuse/fraud checks on signup.

---

## 4. Guided Onboarding

**What the customer sees:** One question per screen (per [`UX_RULES.md`](./UX_RULES.md)), each one framed as "I'm learning about your business," continuing directly from the Snapshot rather than starting over. Customer-type-specific emphasis applies here (see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md)) — GBP-first for local, brand-voice-first for digital, profile-first for platform businesses.

**What the AI is doing:** Requesting the specific connector authorizations and confirmations that unlock the most value fastest for this business's type; declining to ask for anything not immediately useful.

**Data collected:** Business goals, connector authorizations the owner chooses to grant, brand voice notes, and any corrections to the Snapshot draft.

**Invisible:** Which connectors are "recommended first" logic, and any Business Brain confidence scoring behind the scenes.

---

## 5. Business Brain Creation

See [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) for the full architecture.

**What the customer sees:** A single, honest completion moment — "Go back to running your business. I'll take it from here." — not a technical "sync complete" message.

**What the AI is doing:** Composing every input gathered so far (Snapshot, onboarding answers, connector data, any early uploads) into the structured Business Brain record that will power every recommendation, forecast, and Pulse signal going forward.

**Data collected:** Nothing new — this stage is composition, not collection.

**Invisible:** The entire data model: how observations, learnings, preferences, and connector data are normalized into a single structure. Customers never see a schema; they see what it produces.

---

## 6. First Week

**What the customer sees:** The first real output of the Business Brain — an initial recommendation, a first draft, or an honest "still learning, check back soon" state if there isn't enough signal yet. Never a fabricated placeholder in the meantime.

**What the AI is doing:** Running the Marketing Director (and, as later waves ship, the wider Growth Engine intelligence) against the newly-created Business Brain for the first time, and beginning continuous background processes — Market Radar monitoring, Seasonal Intelligence pattern-matching — that don't require the owner's attention yet.

**Data collected:** Approval/edit/reject signal on the first outputs — the first real preference data.

**Invisible:** Everything about pipeline orchestration, retries, and confidence thresholds for what's ready to surface versus still being refined.

---

## 7. Weekly Cadence

**What the customer sees:** The existing Weekly Briefing pattern (see [`../WEEKLY_BRIEFING.md`](../WEEKLY_BRIEFING.md)), now potentially informed by a wider set of Business Brain inputs — Customer Voice themes, Market Radar changes, Seasonal Intelligence forecasts — surfaced with the same "while you were busy" framing, never as a separate second inbox.

**What the AI is doing:** Continuously updating the Business Brain from every connected source, running Customer Voice analysis on new reviews/calls/messages, checking Market Radar for competitor changes, and composing the week's recommendations from all of it through the single Marketing Director decision layer.

**Data collected:** Ongoing connector sync data, new Customer Voice signal, approval/edit history (which also drives Trust Model progression — see [`../TRUST_MODEL.md`](../TRUST_MODEL.md)).

**Invisible:** Which specific signal triggered which specific recommendation — available on request via Decision Intelligence (see [`../DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md`](../DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md)), never forced on a customer who doesn't ask.

---

## 8. Autopilot

**What the customer sees:** The 2.0 name for the top of the existing Trust Model ("Trusted Head of Marketing" / future "Executive Partner" — see [`../MAGIC_BLUEPRINT.md`](../MAGIC_BLUEPRINT.md)), now scoped to the full Growth Engine rather than marketing alone. Exception-based interruptions only; the owner is told what happened, not asked to approve routine work.

**What the AI is doing:** Operating within the bounds the owner's management style and trust stage allow, across every domain the Business Brain now understands — still gated by the same safety rules as 1.0 (no silent auto-publish, no schedule activation without explicit, separate approval).

**Data collected:** Outcome data feeding back into learnings — did the autonomous action actually help the business grow?

**Invisible:** Nothing should be invisible at this stage that the owner wants to see — Autopilot is a trust destination, and trust requires that anything can be inspected on request, even though nothing is forced into view by default.

---

## Journey → Growth Engine mapping

| Journey need | 1.0 today | 2.0 direction |
|---|---|---|
| Pre-signup proof | Interactive demo (generic) | Free Marketing Snapshot (the business's *own* data) |
| First understanding of the business | Onboarding wizard + website analysis | Business Brain, composed from Snapshot + connectors + uploads from minute one |
| Ongoing intelligence input | Marketing-specific signals (GBP, approvals, reviews) | Broadened to Customer Voice, Market Radar, Seasonal Intelligence, Smart Uploads, Connector Framework |
| Executive view | Marketing Health | Business Pulse (Marketing Health + Growth Momentum, still layered — see [`BUSINESS_PULSE.md`](./BUSINESS_PULSE.md)) |
| Trust ceiling | Trusted Head of Marketing (marketing scope) | Autopilot (Growth Engine scope, same safety gates) |

This mapping is the connective tissue between the 1.0 constitution and the 2.0 vision: nothing in the left column is deprecated. Everything in the right column is what it grows into.
