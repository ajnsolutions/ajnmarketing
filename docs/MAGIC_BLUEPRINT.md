# Magic Blueprint — Product Design Constitution

**Status:** Authoritative product architecture for Project Magic  
**Companions:** Manifesto · Journeys · Trust · Health · Voice · Nav · Dashboard · Roadmap

This document is the master map. Detailed expansions live in the companion files.

---

## 1. Product thesis

AJN Marketing = **a Head of Marketing relationship**, delivered through software.

The relationship deepens over time as trust is earned. Autonomy increases only when the owner’s chosen **management style** and proven approval history allow it. Approval, publishing, and schedules remain explicit and gated until product and ops deliberately expand them.

---

## 2. Relationship model (trust stages)

See [`TRUST_MODEL.md`](./TRUST_MODEL.md) for full definitions.

| Stage | Owner feels | AJN behaves like |
|---|---|---|
| Assistant | “Help me get set up” | Careful, explanatory, low autonomy |
| Coordinator | “Keep me in the loop weekly” | Reliable weekly cadence |
| Marketing Manager | “Handle the plan; ask when needed” | Strong recommendations, crisp asks |
| Head of Marketing | “You’ve got this” | High confidence, exception-based asks |
| Executive Partner *(future)* | “Advise the business” | Strategy + outcomes, rare interruptions |

Promotion is earned, reversible, and always visible to the owner.

---

## 3. Management styles (replaces raw “approval frequency”)

See [`TRUST_MODEL.md`](./TRUST_MODEL.md#management-styles).

| Style | Cadence feel | Autonomy |
|---|---|---|
| Hands-On Owner | Approve almost everything | Low |
| Weekly Manager | One weekly package | Medium |
| Monthly Executive | Monthly review + exceptions | High |
| Trusted Head of Marketing | Exception-based | Highest (still bounded by product gates) |

Styles are owner-chosen preferences. They constrain how often we interrupt — they never silently bypass safety, legal, or publishing gates.

---

## 4. Personas (summary)

See [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md) for detail.

### Local business owner
Contractors, dentists, restaurants, landscapers, law offices, insurance agencies — time-poor, mobile-first, skeptical of agencies, want phone calls and reputation, not dashboards.

### Online business owner
Coaches, consultants, SaaS, agencies, e-commerce — more digital-native, still hate busywork; want consistent presence and clear ROI narrative without tool sprawl.

Both personas share: **one next step**, **calm voice**, **outcome language**.

---

## 5. Experience architecture

| Layer | Customer sees | Stays internal |
|---|---|---|
| Public | Confidence, simplicity, demo of “what we’d do” | Engines, scores, job IDs |
| Onboarding | “I’m learning your business” | Data model, sync jobs |
| Dashboard | Health + attention + done-for-you summary | Command-center density |
| Marketing | Approvals & drafts that matter | Opportunity detectors, pipelines |
| Results | Marketing Health + plain-English wins | Raw analytics tables |
| Admin | Operating console for AJN staff | Never customer-facing |

---

## 6. Magic without theater

Magic moments (see journeys) are **truthful emotional peaks**: setup complete, nothing to review, weekly “while you were busy,” trust promotions.

Forbidden theater: fake scores, invented testimonials, “AI ranked you,” auto-publish claims, urgency badges for routine work.

---

## 7. Standing engineering constraints

These remain true unless a future PR explicitly changes them with ops approval:

- `ATTACH_DECLARATIVE_PRODUCTION_CRONS = false` until schedule activation is approved
- No silent auto-publish / auto-approve
- Tenant isolation intact
- Customer UI never requires understanding internal engine names

---

## 8. Public website philosophy

Do **not** sell AI. Sell confidence, simplicity, consistency, and peace of mind.

| Pillar | Message |
|---|---|
| Positioning | Hiring a Head of Marketing — not buying software |
| StoryBrand | Hero (owner) → Problem (no time / anxiety) → Guide (AJN) → Plan (connect, we work, you approve) → Success (marketing taken care of) |
| Local | Google presence, reviews, calls, reputation |
| Online | Consistent presence without tool sprawl |
| AI-assisted search | Factual: people search on Google and AI assistants; we help publish trustworthy local info — **no ranking promises** |
| Guarantee | Visibility guarantee as risk reversal — never as hype |

Interactive demo proves “what we’d do,” then invites account creation.

---

## 9. Customer success philosophy

Success is **not** post counts, review counts as vanity, or dashboard logins.

Success **is**:

- Marketing feels taken care of  
- Owner confidence is up; anxiety is down  
- Business stays visible and trustworthy  
- Customers can find and choose the business  
- Owner effort stays low and predictable  

Support and CS conversations should reinforce the Head-of-Marketing relationship, not train owners to become marketers.

---

## 10. Admin philosophy

The internal operating console optimizes for **operating AJN Marketing**, not for owner calm.

See [`NAVIGATION_PHILOSOPHY.md`](./NAVIGATION_PHILOSOPHY.md). Admins need customer health, trust progression, marketing health aggregates, AI health, revenue/pilot economics, operations, support, opportunities, and roadmap — with density that would be harmful in the customer UI.

---

## 11. Design principles (non-negotiable for future UI)

1. Never expose internal systems as first-class customer navigation.  
2. Never require unnecessary decisions.  
3. Every screen has one primary action.  
4. Every page answers “What should I do next?”  
5. Every interaction should reduce anxiety.  
6. Every feature should feel like the Head of Marketing is working behind the scenes.  
7. Magical without pretending magic — no fabricated metrics or unsupported claims.  
8. Label examples vs live findings.  
9. Progressive disclosure over kitchen-sink pages.  
10. Customer and admin experiences stay separate.

---

## 12. Document map

| Doc | Role |
|---|---|
| [`PROJECT_MAGIC_MANIFESTO.md`](./PROJECT_MAGIC_MANIFESTO.md) | Why / principles |
| [`MAGIC_BLUEPRINT.md`](./MAGIC_BLUEPRINT.md) | This master map |
| [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md) | Personas, journeys, magic moments |
| [`TRUST_MODEL.md`](./TRUST_MODEL.md) | Stages + management styles |
| [`MARKETING_HEALTH.md`](./MARKETING_HEALTH.md) | Health signal design |
| [`VOICE_AND_PERSONALITY.md`](./VOICE_AND_PERSONALITY.md) | Tone & copy rules |
| [`NAVIGATION_PHILOSOPHY.md`](./NAVIGATION_PHILOSOPHY.md) | Customer vs admin IA |
| [`DASHBOARD_PHILOSOPHY.md`](./DASHBOARD_PHILOSOPHY.md) | Home experience |
| [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md) | Phased delivery |
| [`PROJECT_MAGIC_README.md`](./PROJECT_MAGIC_README.md) | Index / completeness checklist |
