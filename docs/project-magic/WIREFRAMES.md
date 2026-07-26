# Project Magic 2.0 — Wireframes

**Companion to:** [`INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md)

Low-fidelity, text-based wireframes for every net-new surface in this blueprint. These are structural — they show layout, hierarchy, and content relationships, not visual design. Existing surfaces (Head of Marketing, Weekly Briefing, Approvals, Results, Settings, Setup) are not redrawn; see the existing product for their current, unmodified layouts.

---

## Free Marketing Snapshot

```
┌─────────────────────────────────────────────────────────┐
│  "See what your customers see"                            │
│  [ Business name................ ] [ Website or profile URL... ] │
│                          [ Show me →  ]                    │
└─────────────────────────────────────────────────────────┘

                    ↓ (after scan completes)

┌─────────────────────────────────────────────────────────┐
│  What Customers See — [Business Name]                     │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  🌐  YOUR WEBSITE                                          │
│  "Here's what a customer reading your site would learn..." │
│  [ ✓ Looks right ]  [ ✎ Edit ]  [ 💬 Add context ]          │
│                                                            │
│  📍  GOOGLE BUSINESS PROFILE                                │
│  "Here's what shows up when someone searches..."           │
│  [ ✓ Looks right ]  [ ✎ Edit ]  [ 💬 Add context ]          │
│                                                            │
│  ⭐  REVIEWS                                                │
│  "Customers mention: fast response, friendly staff..."     │
│  [ ✓ Looks right ]  [ ✎ Edit ]  [ 💬 Add context ]          │
│                                                            │
│  🏁  HOW YOU COMPARE                                        │
│  vs. [Competitor A] · vs. [Competitor B]                    │
│  "One thing they're doing that you're not yet..."           │
│                                                            │
│  ─────────────────────────────────────────────────────── │
│           [ This looks right — grow my business → ]        │
└─────────────────────────────────────────────────────────┘
```

Notes: one card per source, each independently actionable (no "review everything then submit" batch pattern — respects one-question-at-a-time in spirit even though findings are grouped visually for scanability). Primary CTA leads to Signup with the session's approvals/edits carried forward.

---

## Business Brain view ("what I know about you")

```
┌─────────────────────────────────────────────────────────┐
│  What I Know About Your Business                          │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  ✅ Confirmed by you                                        │
│  • Business name, hours, service area                      │
│  • Brand voice: friendly, direct                            │
│  • Top service: AC repair                                   │
│                                                            │
│  📚 Learned from connected sources                          │
│  • Website (last synced 2 days ago)                         │
│  • Google Business Profile (last synced 6 hours ago)        │
│                                                            │
│  📎 Learned from what you shared                            │
│  • Spring pricing sheet.pdf → "I learned your tune-up        │
│    pricing starts at $89"                                   │
│                                                            │
│  ❓ Still learning                                          │
│  • I don't have call data yet — connect a phone system      │
│    so I can learn from customer calls                        │
│                                                            │
│               [ Add more →  See connectors → ]              │
└─────────────────────────────────────────────────────────┘
```

Notes: this is the transparency surface — it exists so an owner who *does* want to see behind the curtain can, without ever being required to. Every line is honest about source and freshness (Living Market Intelligence principle).

---

## Smart Uploads

```
┌─────────────────────────────────────────────────────────┐
│  Share something with me                                  │
│                                                            │
│   ┌───────────────────────────────────────────┐          │
│   │                                             │          │
│   │     Drop a file here, or click to browse     │          │
│   │     PDFs, spreadsheets, docs, photos,         │          │
│   │     videos, call notes — anything helps        │          │
│   │                                             │          │
│   └───────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘

                    ↓ (after processing)

┌─────────────────────────────────────────────────────────┐
│  ✓ spring-pricing.pdf                                      │
│                                                            │
│  "I learned your tune-up pricing starts at $89, and you     │
│   offer a spring maintenance package. I've added this to    │
│   what I know about your business."                          │
│                                                            │
│               [ See what I know → ]  [ Add another ]        │
└─────────────────────────────────────────────────────────┘
```

Notes: single drop zone, no format picker. The "I learned..." message is mandatory, not optional copy — see [`SMART_UPLOADS.md`](./SMART_UPLOADS.md).

---

## Connector Framework hub

```
┌─────────────────────────────────────────────────────────┐
│  Connect the tools you already use                        │
│  The more I can see, the more I can help.                  │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  Digital Presence                                          │
│  🌐 Website          ● Connected                            │
│  📍 Google Business   ● Connected                            │
│  📱 Social            ○ Not connected      [ Connect ]      │
│                                                            │
│  Scheduling                                                │
│  📅 Booking calendar  ○ Not connected      [ Connect ]      │
│                                                            │
│  Communication                                              │
│  ☎️  Call tracking     ○ Not connected      [ Connect ]      │
│                                                            │
│  CRM                                                        │
│  👥 Contacts           ○ Not connected      [ Connect ]      │
│                                                            │
│  Don't see your tool? [ Share a file instead → ]            │
└─────────────────────────────────────────────────────────┘
```

Notes: grouped by category per [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md); every category always visible even at zero connections (honest about what's not yet connected, never hidden); explicit fallback link to Smart Uploads.

---

## Market Radar

```
┌─────────────────────────────────────────────────────────┐
│  Keeping an eye on your market                             │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  Tracking 3 competitors                    [ Manage → ]    │
│  • [Competitor A] — new spring promo detected (2 days ago) │
│  • [Competitor B] — no changes recently                    │
│  • [Competitor C] — no changes recently                    │
│                                                            │
│  Benchmarking                                               │
│  • [Aspirational Co.] — for inspiration, not comparison      │
│                                                            │
│  [ + Add a competitor ]  [ + Add a benchmark ]              │
└─────────────────────────────────────────────────────────┘
```

Notes: reachable via progressive disclosure, never a default landing view; changes are stated as information, not alarms (no red badges for a competitor's routine activity).

---

## Business Pulse

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 (default) — on the existing HoM dashboard          │
│  "Marketing Health: Healthy. Growth Momentum: Growing.       │
│   Nothing needs you this week."          [ See more → ]     │
└─────────────────────────────────────────────────────────┘

                    ↓ [ See more ]

┌─────────────────────────────────────────────────────────┐
│  Business Pulse                                             │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  Marketing Health: ● Healthy                                │
│  "You're in good shape. This week I'm focused on..."        │
│                                                            │
│  Growth Momentum: ● Growing                                 │
│  "Customer sentiment trending up, you're ahead of the        │
│   season on spring promotions, and one competitor just       │
│   launched a promo worth watching."                         │
│                                                            │
│  [ Why this status? ]  (progressive disclosure — expands     │
│                          into the contributing signals)      │
└─────────────────────────────────────────────────────────┘
```

Notes: Layer 1 is a single sentence, always. Layer 3 never appears without the owner explicitly choosing to go deeper.

---

## IA placement option A — "Business" as a new primary nav item

```
┌───────────────────────────────────────────────────┐
│  Your Head of Marketing │ Results │ Library │ Business │ Settings │
└───────────────────────────────────────────────────┘
```

## IA placement option B — nested under Settings (no new primary nav item)

```
┌───────────────────────────────────────────────────┐
│  Your Head of Marketing │ Results │ Library │ Settings │
└───────────────────────────────────────────────────┘
                                              │
                                              ▼
                              Settings → Business Brain, Connectors, Market Radar
```

**Recommendation for implementation-time decision:** start with Option B (nested, no new primary nav item), consistent with [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md)'s existing bias against adding primary nav items lightly. Promote to Option A only if usage data shows owners genuinely struggle to find these surfaces nested — the same evidence-before-expansion discipline the existing nav already follows.
