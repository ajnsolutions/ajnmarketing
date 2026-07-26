# Project Magic 2.0 — Existing System Audit

**Companion to:** [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md) (this audit is that roadmap's evidence base)

A component-by-component review of the current AJN Marketing implementation against the 2.0 vision. Every row is classified:

- **Already Exists** — genuinely built and working; 2.0 reuses it as-is
- **Needs Redesign** — exists, but its current shape doesn't fit the 2.0 model and should change before extending it
- **Needs Expansion** — exists as a real foundation, but its scope is narrower than 2.0 requires
- **New Functionality** — does not exist yet in any form

This audit is written from direct inspection of `lib/`, `app/`, and the existing `docs/` constitution — not from assumption. It is the seed of the 2.0 implementation backlog.

---

## Business Brain

| Component | Classification | Notes |
|---|---|---|
| Marketing Memory (observations/learnings/preferences/decisions/outcomes) | **Already Exists** | `lib/marketing-memory/` — full four-layer model, RLS-protected, Phases 1–4 implemented and consumed by Marketing Director. This *is* the Business Brain's foundation. |
| Multi-source composition into one explainable understanding (Known/Assumed/Missing) | **Shipped since this audit (Wave I)** | `lib/business-discovery/` — see [`../BUSINESS_DISCOVERY_ENGINE.md`](../BUSINESS_DISCOVERY_ENGINE.md). Read-only composition over existing sources; does not yet persist a Business Brain record or feed Marketing Memory's `learnings` layer. |
| Broader input surface (connectors beyond GBP, uploads, Customer Voice, Market Radar) | **Needs Expansion** | The data model already accepts evidence-linked observations from any source; what's missing is the sources themselves, not the structure. |
| Cross-domain output surface (beyond marketing recommendations) | **New Functionality** | Marketing Director is, deliberately, marketing-only today. A broader Growth Engine decision surface is genuinely new, and must not become a second decision engine competing with Marketing Director (see [`../MARKETING_DIRECTOR_ARCHITECTURE.md`](../MARKETING_DIRECTOR_ARCHITECTURE.md)). |

## Free Marketing Snapshot

| Component | Classification | Notes |
|---|---|---|
| Website analysis pipeline | **Already Exists** | `lib/website-analysis/` — extraction, tone, keywords, SEO findings, scored analysis. Authenticated-session only today. |
| AI Marketing Profile generation | **Already Exists** | `lib/ai-marketing-profile/` — synthesizes a business profile from analysis + business data. |
| Public, pre-auth "What Customers See" experience | **New Functionality** (backend foundation shipped) | The authenticated-session orchestration layer (AI Business Discovery, see [`../BUSINESS_DISCOVERY_ENGINE.md`](../BUSINESS_DISCOVERY_ENGINE.md)) and now a secure public/pre-auth variant with a hardened SSRF-safe fetch path and a versioned public contract (see [`../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md)) both exist. The landing page, results presentation UI, and account-conversion flow remain the single biggest net-new build left in Wave I — see [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md). |
| Interactive demo | **Already Exists** (different shape) | `lib/interactive-demo/` provides a generic, non-business-specific proof experience. Stays as a secondary path; does not need to be replaced. |

## Connector Framework

| Component | Classification | Notes |
|---|---|---|
| Google Business Profile connector | **Already Exists** | `lib/google-business-profile/` — full OAuth, sync, health-state model (connected/needs reauth/unavailable), persistence. This is the reference implementation the Connector Framework's five-stage contract generalizes. |
| Website "connector" | **Already Exists** (as a scan, not an authenticated connector) | No ongoing auth/health/revoke lifecycle — it's a one-shot/re-triggerable analysis, not a persistent connection. |
| A named, general connector contract (auth/sync/health/revoke/customer-safe-errors) as a reusable pattern | **Needs Redesign** | The *pattern* exists inside the GBP implementation but isn't extracted as a reusable contract other connectors can implement against. Worth formalizing before building connector #2. |
| CRM, Scheduling, Finance, Communication, Industry-Specific connectors | **New Functionality** | None exist today. |

## Smart Uploads

| Component | Classification | Notes |
|---|---|---|
| Any file-upload-to-intelligence pipeline | **New Functionality** | No equivalent exists today. Business profile data is currently entered via forms or synced via connectors/scans — not extracted from arbitrary uploaded documents. |

## Customer Voice

| Component | Classification | Notes |
|---|---|---|
| Review reading for reply drafting | **Already Exists** | Google review-reply generation (`lib/google-business-server.ts` and related) reads individual reviews to draft replies. |
| Aggregate theme/sentiment extraction across reviews, calls, messages | **New Functionality** | No sentiment or theme-extraction layer exists (confirmed: no "sentiment" concept anywhere in `lib/`). This is real net-new intelligence, not a relabeling of something that exists. |
| Call/message/email connectors as Customer Voice sources | **New Functionality** | Depends on Communication connector category, which doesn't exist yet. |

## Market Radar

| Component | Classification | Notes |
|---|---|---|
| Market context provider system | **Already Exists** | `lib/market-context/` — categories already include `weather`, `holiday`, `local_event`, `school_calendar`, `competitor`, `news`, `trend`, each with relevance/confidence scoring (`contextScoringService.ts`) and a dedicated `competitorProvider.ts` / `competitorProfile.ts`. This is a substantially real foundation — **the audit corrects an assumption that Market Radar is greenfield; it is not.** |
| Owner-facing competitor add/remove/prioritize control | **Needs Expansion** | Competitor tracking today is populated by the pipeline/admin path, not a self-service owner control surface. |
| Aspirational-benchmark tracking (non-competitor) | **New Functionality** | No concept of tracking a non-competitor benchmark exists today. |
| Continuous, owner-visible Market Radar view | **Needs Expansion** | Market context feeds recommendations internally; there's no dedicated, owner-facing "what's happening in your market" screen yet. |

## Seasonal Intelligence

| Component | Classification | Notes |
|---|---|---|
| Seasonal/recurrence pattern detection | **Already Exists** | `lib/marketing-memory/seasonality.ts` — deterministic recurrence classification (`RECURRING_WEEKLY`, `ANNUAL_MONTH`, `ANNUAL_RANGE`) already feeds the Learnings layer's confidence model. **Another corrected assumption — Seasonal Intelligence has a genuine foundation, not a blank slate.** |
| Weather/holiday/school-calendar signal | **Already Exists** | Already modeled as `market-context` categories. |
| Forward-looking, lead-time-aware forecast output (not just backward-looking pattern classification) | **Needs Expansion** | Today's seasonality logic classifies *past* evidence into recurring patterns for the confidence model; it does not yet produce a forward "act now, before the season starts" forecast artifact. |
| Owner-facing seasonal forecast copy | **New Functionality** | No customer-facing "here's a seasonal opportunity" surface exists independent of whatever a recommendation happens to say. |

## Business Pulse

| Component | Classification | Notes |
|---|---|---|
| Marketing Health | **Already Exists** | Fully designed (`../MARKETING_HEALTH.md`) — implementation status should be verified against current dashboard code at build time, but the design and states are authoritative and unchanged by 2.0. |
| Growth Momentum signal | **New Functionality** | No cross-domain momentum signal exists; must be composed from Marketing Health + Customer Voice + Market Radar + Seasonal Intelligence outputs once those exist. |
| Weekly email / monthly report delivery | **Already Exists** (weekly) / **Needs Expansion** (monthly) | Weekly Briefing/Approval Package pattern is real and working. A monthly Business Pulse report in the same spirit is new composition, not new infrastructure — `EXECUTIVE_BRIEFING_ENGINE.md`'s Monthly brief type is already built but not yet surfaced (per `../PROJECT_MAGIC_README.md`). |
| Mobile parity | **Needs Expansion** | Should be verified against current responsive implementation at build time; no known mobile-specific blocker, but not explicitly audited here. |

## Customer Types

| Component | Classification | Notes |
|---|---|---|
| Local/digital persona definitions and journey mapping | **Already Exists** | `../CUSTOMER_JOURNEYS.md` — detailed, table-driven, already informs onboarding tone. |
| Platform business type (e.g., AJN Sports Coaches) as a first-class onboarding/Business-Brain path | **New Functionality** | No existing onboarding path assumes "no independent website, primary presence is a hosted profile." This requires new onboarding branching logic, not just new copy. |

## Trust Model / Autopilot

| Component | Classification | Notes |
|---|---|---|
| Trust stages and management styles | **Already Exists** | `../TRUST_MODEL.md` — fully designed; implementation status of stage progression itself should be verified at build time. |
| Scope broadened from marketing-only to Growth-Engine-wide autonomy | **Needs Redesign** | The trust *model* (stages, styles, promotion/demotion) generalizes cleanly, but any implementation that currently gates only marketing actions needs to widen its gating surface as new domains (Business Brain outputs beyond marketing) come online — without loosening the existing safety rules. |

## Cross-cutting: safety and gating

| Component | Classification | Notes |
|---|---|---|
| `ATTACH_DECLARATIVE_PRODUCTION_CRONS` cron gate | **Already Exists** | `lib/trigger/scheduleActivation.ts` — confirmed `false`; every new capability in this blueprint inherits this gate unchanged. |
| Tenant isolation (RLS + application-level ownership checks) | **Already Exists** | Established, consistent pattern across every subsystem reviewed (Marketing Memory, GBP, business-profile, assisted-pilot). New connector categories and Business Brain inputs must follow the identical pattern — this is a "needs consistent application," not a "needs redesign," item. |
| Admin/customer boundary (no secrets, no raw provider payloads in customer or admin-visible-to-non-admin UI) | **Already Exists** | Enforced pattern across ops-dashboard, assisted-pilot, production-readiness. New connector health/admin visibility (see [`INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md)) must follow it, not invent a new boundary rule. |

---

## Summary: what this audit changes about the plan

The single most important correction this audit makes to the naive reading of the blueprint: **Market Radar and Seasonal Intelligence are not greenfield.** `lib/market-context/` and `lib/marketing-memory/seasonality.ts` are real, working foundations. The 2.0 work here is expansion and owner-facing surfacing — a materially smaller and lower-risk lift than building either from scratch. This directly informs the wave sequencing in [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md): these move earlier than a naive "hardest things need the most lead time" ordering would suggest, precisely because the hard part is already built.

The single largest genuine net-new build across the entire blueprint is the **Free Marketing Snapshot's pre-authentication experience** — every other net-new item (Smart Uploads, Customer Voice sentiment extraction, the general Connector Framework contract, Growth Momentum) has a real, reusable foundation to extend. The Snapshot does not.
