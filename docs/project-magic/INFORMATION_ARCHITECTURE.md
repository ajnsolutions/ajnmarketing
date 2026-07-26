# Project Magic 2.0 — Information Architecture

**Companion to:** [`WIREFRAMES.md`](./WIREFRAMES.md) · [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md) (existing customer/admin IA — unchanged, extended here)

This document maps every screen relevant to the 2.0 vision and shows how new surfaces attach to the existing, unchanged navigation model. It does not redraw or replace the existing IA — see [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md) and [`../GREAT_SIMPLIFICATION.md`](../GREAT_SIMPLIFICATION.md) for the current, authoritative primary nav (Your Head of Marketing / Results / Library / Settings).

---

## Public (pre-signup) IA

```
Public site
├── Homepage — Head-of-Marketing positioning (unchanged, 1.0)
├── Free Marketing Snapshot  ← NEW primary entry point
│   ├── "Enter your business" (name + URL, or platform profile lookup)
│   ├── "What Customers See" results view
│   │   ├── Website read
│   │   ├── Google Business Profile read
│   │   ├── Reviews theme/sentiment read
│   │   ├── Social presence read
│   │   └── Competitor comparison (2-3 named competitors)
│   └── Approve / Edit / Comment / Correct actions on each finding
│         └── → Signup (session preserved)
├── Interactive demo (existing, 1.0) — remains as a generic proof path for
│   prospects who skip the Snapshot's business-specific flow
└── Pricing / Features / Industries / For Agencies (existing, unchanged)
```

The Free Marketing Snapshot becomes the **primary** public conversion path; the existing interactive demo remains available as a secondary, generic proof point for a prospect not ready to enter their own business yet.

## Onboarding IA

```
Signup → Guided Onboarding (existing Magic wizard, extended)
├── Continues directly from Snapshot corrections (no re-asking)
├── Customer-type-aware step ordering (see CUSTOMER_TYPES.md)
│   ├── Local: Google Business Profile connect emphasized early
│   ├── Digital: Brand voice + audience emphasized early
│   └── Platform: Platform profile confirm/enrich (no "connect website" step)
├── Existing steps (business info, goals, brand voice) — unchanged
└── Completion → Business Brain creation moment → /dashboard
```

## Authenticated dashboard IA — new surfaces attach as siblings, not replacements

```
/dashboard (existing Head of Marketing home — unchanged primary surface)
│
├── Your Head of Marketing (existing primary nav item — unchanged)
│   ├── Weekly Briefing (existing)
│   ├── Campaigns / Experiments / Decision Intelligence (existing)
│   ├── Strategic Marketing Calendar (existing)
│   └── Ask Your Head of Marketing (existing)
│
├── Results (existing primary nav item — extended)
│   ├── Marketing Health (existing — unchanged)
│   └── Business Pulse  ← NEW, one level deeper (progressive disclosure)
│       └── Growth Momentum detail view
│
├── Library (existing primary nav item — unchanged)
│
├── Business  ← NEW conceptual grouping (may live under Settings or its own
│   │           progressive-disclosure area — exact placement is an
│   │           implementation-time IA decision, not fixed here)
│   ├── Business Brain view (evidence-transparency; "what I know about you")
│   ├── Smart Uploads
│   ├── Connectors  ← generalizes today's single "connect Google" flow
│   │   ├── Digital Presence (Website, GBP, Social)
│   │   ├── CRM
│   │   ├── Scheduling
│   │   ├── Finance
│   │   ├── Communication
│   │   └── Industry-Specific
│   └── Market Radar
│       ├── Tracked competitors (add/remove/prioritize)
│       └── Aspirational benchmark
│
└── Settings (existing primary nav item — unchanged; Business Brain/Connectors
    may surface here instead of a new top-level area, per NAVIGATION_PHILOSOPHY.md's
    existing preference for progressive disclosure over new primary nav items)
```

**Design decision explicitly deferred to implementation:** whether "Business" surfaces as a new primary nav item or nests inside Settings is an information-architecture call that should be made with real navigation-philosophy review at build time (see [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md)'s existing design principle of never adding primary nav items lightly). This document intentionally does not force that decision — see [`WIREFRAMES.md`](./WIREFRAMES.md) for both layout options sketched.

## Admin IA — extends the existing operating console

```
/dashboard/admin/ops (existing — unchanged core)
├── Existing: readiness, tenant health, ops, pilot (unchanged)
└── NEW admin-only visibility (no new customer-facing admin concepts):
    ├── Connector health across tenants (extends existing per-tenant health view)
    ├── Business Brain completeness/freshness per tenant (operational signal only)
    └── Market Radar coverage (which businesses have active competitor tracking)
```

Admin additions are **read-only operational visibility**, following the exact pattern already established for tenant/setup health in [`../PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md`](../PRODUCTION_OPERATIONS_AND_PILOT_HARDENING.md) — no new admin mutation surface, no new decision engine, no schedule.

## Navigation rules carried forward unchanged

From [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md), binding on every new surface above:

- Never expose internal systems (Business Brain, connectors-as-a-concept) as first-class navigation language a customer must learn
- Customer and admin IA remain fully separate
- New primary nav items are added rarely and only after progressive-disclosure placement has been genuinely tried first
