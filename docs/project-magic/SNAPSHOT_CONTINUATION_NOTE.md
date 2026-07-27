# Implementation Note — Snapshot Continuation

**Companion to:** [`PUBLIC_SNAPSHOT_FOUNDATION_NOTE.md`](./PUBLIC_SNAPSHOT_FOUNDATION_NOTE.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`../BUSINESS_DISCOVERY_CONTINUATION.md`](../BUSINESS_DISCOVERY_CONTINUATION.md) (full architecture, threat model, lifecycle)

A short note on how this phase fits together — read the full architecture doc for detail.

## How this supports "Start with understanding, not forms"

The whole point of this phase is that the wizard's first question is never actually the first question. By the time a visitor who ran a Snapshot reaches onboarding, we already know their business name and website — the wizard's form fields are pre-seeded from what we already understood, not blank inputs waiting to be filled from scratch. Understanding came first; the form is just where the visitor confirms and extends it.

## How this supports "Explain before recommending"

Every insight a future confirmation screen shows still carries its `reason` — the plain-language explanation of *why* the AI believes what it believes — all the way from the original anonymous scan through claiming and into the confirmation contract. Nothing here strips that explanation down to a bare value. A visitor deciding whether to confirm "your target customers are homeowners" still sees why the AI thinks so, not just the claim.

## How this supports Business Brain source separation

The confirmation contract is built specifically to keep four categories distinct and never let them blur into each other: the raw observation (what a source literally said), the AI interpretation (the Assumed insight built from it), the user-confirmed fact (only after an explicit decision), and the rejected inference (explicitly marked "no," not just ignored). This is the same separation [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) describes as the long-term architecture — this phase is the first place a *user's own decision* becomes one of those four categories, rather than only AI output.

## How this supports explicit user confirmation

Structurally, not just by convention: the only function in this codebase capable of marking something a `known_fact` requires an authenticated `userId`, a claimed reference, and an explicit decision object. There is no code path — no timer, no default, no "we'll assume yes" — that promotes an Assumed insight on its own. Confirmation is a verb a real person performs, not a state that happens to data over time.

## How this supports preservation of simplicity

A visitor experiences exactly two new things because of this phase: they don't have to retype what they already told us, and later (once the review UI exists) they'll see a short, plain list of things to say yes/no/fix to. Everything else — DNS-safe fetching, opaque unguessable references, ownership conflicts, TTL bookkeeping, tamper-resistant provenance — happens entirely behind that, exactly where Principle Zero says it belongs. See [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md).
