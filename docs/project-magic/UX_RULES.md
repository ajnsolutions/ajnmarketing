# Project Magic 2.0 — UX Rules

**Companion to:** [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) · [`../DASHBOARD_PHILOSOPHY.md`](../DASHBOARD_PHILOSOPHY.md) · [`../NAVIGATION_PHILOSOPHY.md`](../NAVIGATION_PHILOSOPHY.md) · [`../VOICE_AND_PERSONALITY.md`](../VOICE_AND_PERSONALITY.md)

These rules apply to **every** customer-facing screen shipped under the Project Magic 2.0 banner — existing surfaces and every new one (Free Marketing Snapshot, Business Brain views, Smart Uploads, Connector Framework hub, Market Radar, Business Pulse). They are inherited directly from Project Magic 1.0's design principles (see [`../MAGIC_BLUEPRINT.md`](../MAGIC_BLUEPRINT.md) §11) and restated here as enforceable rules specific to the Growth Engine's new surfaces.

---

## Conversation before dashboards

The default view of any new capability is a plain-language statement of what's true and what to do about it — not a chart, not a table, not a grid of metrics. Dashboards and deeper data exist one layer down, for the owner who asks for them.

*Applies to:* Business Pulse (Layer 1 before Layer 3), Market Radar (Weekly Briefing mention before the dedicated view), Seasonal Intelligence (a forecast sentence before any underlying chart).

## One question per screen

Never ask for more than one decision, confirmation, or piece of information per screen. This is especially binding for Guided Onboarding and Smart Uploads, where it would be easy to batch several inputs into one form for engineering convenience.

*Test:* Count the decisions a screen requires. More than one → split it.

## Simple language, no jargon

"Business Brain," "connector," "observation," "learning" — these are internal/documentation terms. Customer-facing copy never uses them. A connector is introduced by what it does ("Connect your booking calendar so I can spot busy seasons early"), never by its category name.

*Test:* Would this sentence make sense to someone who has never heard the term "AI," "connector," "data pipeline," or "algorithm"?

## Progressive disclosure

Every new surface has a default (calm, simple, one primary action) and an optional deeper view (for power users). The deeper view is never the default and never required to get value from the default.

*Applies to:* Business Pulse Layer 3, Market Radar's dedicated view, Decision Intelligence-style "why" explanations for any new forecast or recommendation type.

## Power users can drill down; casual users never have to

The existence of a deeper view must never leak into the casual experience as an unexplained affordance ("what's this extra tab?") or as a requirement to understand the product. If a feature only makes sense to a power user, it lives behind disclosure, not on the primary path.

## Honesty over polish

Every claim, score, forecast, or "I learned..." statement must be traceable to real data. No placeholder content presented as real, no fabricated confidence, no example dressed up as a live result. This is the single most consistently enforced rule across every past review in this engagement (see [`../RC1_AUTHENTICATED_PILOT_VALIDATION.md`](../RC1_AUTHENTICATED_PILOT_VALIDATION.md)) and it applies with equal force to every new Growth Engine surface.

## Calm, not urgent, by default

Follows [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)'s messaging rules for every new signal type (Growth Momentum, Seasonal Intelligence forecasts, Market Radar alerts): one primary reason, one primary action, restrained color, no alarmist animation for routine information.

## Mobile parity

Every new surface works on mobile with the same information hierarchy as desktop — not a stripped-down mobile view and a "full" desktop view. Business Pulse in particular must be genuinely usable on a phone, since that's where a busy owner is most likely to check it (per the explicit mobile requirement in this blueprint's Business Pulse spec).

## Accessibility is not optional

Every new screen: proper heading structure, labeled form controls, `role="status"` for save/success confirmations, `aria-pressed` for toggle controls, keyboard navigability, and no color-only status communication. This is the established baseline across the current product (see prior accessibility passes in [`../CUSTOMER_EXPERIENCE_POLISH.md`](../CUSTOMER_EXPERIENCE_POLISH.md) and [`../GUIDED_ONBOARDING_AND_SETUP.md`](../GUIDED_ONBOARDING_AND_SETUP.md)) and 2.0 does not get a pass on it for being new.

## Every screen answers "what should I do next?"

Carried forward unchanged from [`../MAGIC_BLUEPRINT.md`](../MAGIC_BLUEPRINT.md) — this is not a 2.0-specific addition, it's a reminder that new surfaces don't get an exception.
