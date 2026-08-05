# Project Magic 2.0 — Business Pulse

**Companion to:** [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md) (existing, unmodified — the primary results language for marketing specifically) · [`../DASHBOARD_PHILOSOPHY.md`](../DASHBOARD_PHILOSOPHY.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md)

Business Pulse is the executive view of the Growth Engine — a superset of Marketing Health, not a replacement for it. Marketing Health stays exactly as designed and continues to be the primary results language for marketing outcomes. Business Pulse adds the layer above it for the owner who wants the fuller growth picture.

**Implementation status (2026-08-04):** the first real slice of Business Pulse has shipped — a Market Radar-only "What Changed" view, not the full Layer 3 composition described below. `/dashboard/business-pulse` (`app/dashboard/business-pulse/page.tsx`, `components/dashboard/business-pulse-page.tsx`) lists the owner's verified `CompetitorObservation` rows (Task 003, `lib/competitor-observations/persistence.ts`'s `listCompetitorObservationsForUser`), each joined back to its tracked competitor's name, rendered with a plain-language confidence label (`lib/competitor-observations/confidenceLabels.ts`, never a raw score or a raw `low`/`medium`/`high` string) and its real source provenance (`sourceLabel` as plain text — the persisted data carries no evidence URL, so nothing is linked that isn't real), filterable to high-only / medium-and-above / all (`lib/competitor-observations/display.ts`). Reachable via the "More tools" progressive-disclosure list, no new primary nav item. This is explicitly **not** Growth Momentum, Marketing Health integration, or a composition of Customer Voice + Market Radar + Seasonal Intelligence — the page's own copy says so directly. That fuller Layer 3 vision below remains future, unscoped work, gated (per `.ai/ROADMAP.md`'s Wave IV entry) on Waves I–III shipping real production signal first. The monthly-report delivery surface in the table below is likewise still unbuilt.

---

## Three layers

### Layer 1 — Conversation

The default experience for most owners, most of the time: the Head of Marketing briefing, in plain language, on the existing HoM dashboard surface. No numbers required to understand it. This layer is unchanged from Project Magic 1.0's core interaction model — see [`../DASHBOARD_PHILOSOPHY.md`](../DASHBOARD_PHILOSOPHY.md) and [`../WEEKLY_BRIEFING.md`](../WEEKLY_BRIEFING.md).

### Layer 2 — Marketing Health

The existing red/yellow/green (Excellent / Healthy / Needs Attention / At Risk) signal, unchanged — see [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md). This remains the primary results language specifically for marketing. Business Pulse does not touch its rules, states, or messaging.

### Layer 3 — Executive analytics: Business Pulse

For the owner who wants to go deeper than "healthy/needs attention," Business Pulse composes:

- **Marketing Health** (unchanged, layer 2, surfaced again here in fuller context)
- **Growth Momentum** — a new, honest signal answering "is the business trending toward or away from its stated goals, across everything the Business Brain understands" — not just marketing activity, but the outcomes Business Brain inputs can actually evidence (Customer Voice sentiment trend, Market Radar competitive position, Seasonal Intelligence timing, connector-sourced demand signal where available)

Business Pulse is explicitly **for power users and curious owners**, reached through progressive disclosure (per [`UX_RULES.md`](./UX_RULES.md)) — never forced onto an owner who's content with Layer 1.

## Growth Momentum: composition, not a new vanity number

Growth Momentum follows the exact design discipline Marketing Health already established (see [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)):

- **Composed, not a single arbitrary score.** No letter grades, no fabricated percentage.
- **Plain-English states**, matching Marketing Health's proven pattern (e.g., Growing / Steady / Needs Focus / At Risk — exact naming to be finalized during design, not invented as canon here).
- **One primary reason, one primary action** — never a wall of contributing metrics presented without a "why" and a "what next."
- **Never outranks the conversation layer.** Just as Marketing Health never outranks Layer 1 today, Growth Momentum never outranks Marketing Health as the primary marketing signal — it's additive context, not a replacement hierarchy.

## Delivery surfaces

| Surface | Cadence | Content |
|---|---|---|
| Weekly email | Weekly | Layer 1 conversation, with Layer 2 Marketing Health state — the existing Weekly Briefing pattern |
| Monthly report | Monthly | Layer 3 Business Pulse — Marketing Health + Growth Momentum, with plain-English "here's what changed and why" |
| Mobile | Always available | All three layers, same content and hierarchy as desktop — no mobile-exclusive data, no desktop-exclusive data (see [`UX_RULES.md`](./UX_RULES.md) mobile parity rule) |
| In-app dashboard | Always available | Layer 1 default; Layer 2/3 one tap away via progressive disclosure |

## Design rules

- **Never lead with a number.** Business Pulse follows Marketing Health's rule exactly: state + plain-English why + one next step, before any supporting figure.
- **Analytics never outrank Pulse.** Just as raw analytics never outrank Marketing Health today, they never outrank Business Pulse either — deep-dive analytics remain available for the genuinely curious, one more level of disclosure down.
- **Honest about incomplete signal.** A business with few connected sources gets an honest, narrower Business Pulse (built from what's actually known) rather than a Growth Momentum score padded with assumptions. Missing signal is stated as missing, not silently defaulted.
- **Calm, always.** Follows [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)'s tone rules — restrained red, calm green, no alarmist animation, no urgency theater for routine states.
