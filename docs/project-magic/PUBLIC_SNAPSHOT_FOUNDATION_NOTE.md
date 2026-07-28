# Implementation Note — Public Snapshot Foundation

**Companion to:** [`FREE_MARKETING_SNAPSHOT.md`](./FREE_MARKETING_SNAPSHOT.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md) (full architecture, threat model, privacy model)

A short note on how this phase fits together — read the full architecture doc for detail.

## How this supports the Free Marketing Snapshot

This is the backend contract the future Snapshot UI will call. A visitor submits a website URL (optionally a name/city/region/country) and gets back a structured, explainable read of their business — no account required. The UI itself (the "What Customers See" presentation, the approve/edit/comment/correct actions) is not built in this phase; only the safe backend it will call is.

## How this supports AI Business Discovery (PR #73)

It's the same discovery abstractions — `DiscoveryInsight`, Known/Assumed/Missing, evidence-linked reasons — reused through a deliberately narrower, separately-typed public contract, not a copy of the logic. Three of PR #73's six pure collectors run unmodified; the other three (Google Business Profile, public reviews, Market Context) simply never run, because there's no authenticated account for them to read from yet.

## How this supports the Business Brain

Nothing here writes to the Business Brain. The public snapshot is deliberately ephemeral — a preview of what the Business Brain *would* look like once real onboarding begins, computed from public/visitor-supplied data alone, then discarded (beyond a short cache window). The first real, durable Business Brain write still happens at Guided Onboarding, after signup — this phase does not move that line.

## How this supports future correction and confirmation

The public result carries an unguessable `snapshotReference` a future signup flow can resolve back to the cached scan, so a visitor who signs up doesn't start over. But nothing here converts an Assumed insight into a Known one automatically — that conversion is reserved for a future, explicit, authenticated confirmation step (an owner saying "yes, that's right"). This phase only makes that future step possible; it does not implement it.

## How this supports "Start with understanding, not forms"

Every design choice here optimizes for the visitor seeing something true and specific about *their* business before being asked to type anything into a form: the URL is the only required input, the AI does the reading and reasoning, and every insight says plainly whether it's confirmed, inferred, or simply not known yet — never fabricated to look more complete than it is. The security hardening (SSRF protection, rate limiting, graceful AI fallback) exists specifically so that this promise holds even for a visitor no one has vetted yet — the complexity of making that safe is the product's to carry, not theirs.
