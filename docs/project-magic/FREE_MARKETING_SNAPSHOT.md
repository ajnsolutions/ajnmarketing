# Project Magic 2.0 — Free Marketing Snapshot

**Companion to:** [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`WIREFRAMES.md`](./WIREFRAMES.md#free-marketing-snapshot)

The Free Marketing Snapshot is the first thing a prospect experiences and the first row ever written to their Business Brain. It replaces a generic interactive demo with something no competitor can copy: **a real read of the prospect's own business**, delivered before they've created an account or given us anything but a name and a URL (or platform profile — see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md)).

**Status:** its backend foundation now exists in two layers — the authenticated AI Business Discovery orchestration ([`../BUSINESS_DISCOVERY_ENGINE.md`](../BUSINESS_DISCOVERY_ENGINE.md)) and, since this pass, the secure public/pre-auth variant described in this document ([`../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](../BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md)). The actual presentation UI, landing page, and account-conversion flow are not yet built — see that document's Recommended Phase 2B.

---

## Purpose

Prove the promise — "You run your business. We'll help you grow it." — instead of asserting it. A prospect who sees their *own* website, their *own* Google Business Profile, their *own* reviews summarized accurately and honestly trusts the product more in thirty seconds than any amount of marketing copy could earn.

## What the AI scans

All public, no-auth-required sources:

- **Website** — content, structure, calls to action, basic SEO signals
- **Google Business Profile** — if publicly discoverable, presence and completeness
- **Social** — publicly visible presence and posting cadence
- **Public reviews** — theme and sentiment read, not just a star average
- **Public business information** — listings, directory presence, NAP (name/address/phone) consistency
- **Competitors** — a small, reasonable default set inferred from category and location (refinable later in [`MARKET_RADAR.md`](./MARKET_RADAR.md))

For platform businesses, the equivalent scan reads the hosted platform profile instead of an independent website — see [`CUSTOMER_TYPES.md`](./CUSTOMER_TYPES.md#3-platform-businesses).

## What the customer sees: "What Customers See"

A single, honest presentation of how the business currently looks to someone finding it online for the first time — organized the way a real prospective customer would experience it, not the way our systems store it:

- What they'd read on the website
- What they'd find on Google
- What they'd read in reviews
- How the business compares to a couple of nearby/similar competitors
- One or two specific, plain-English opportunities (never a vague "improve your SEO")

## What the customer can do

| Action | What it means |
|---|---|
| **Approve** | "Yes, that's accurate" — becomes a confirmed Business Brain fact |
| **Edit** | Correct something the scan got wrong or incomplete — becomes a confirmed fact, replacing the inferred one |
| **Comment** | Add context the scan couldn't know — becomes a note attached to the fact |
| **Correct** | Flag something as flat-out wrong — the scan's guess is discarded, not just deprioritized |

Every one of these actions is Business Brain input. This is the mechanism that makes the Snapshot double as the start of onboarding rather than a disconnected marketing gimmick: **the prospect isn't reviewing a report, they're building the first version of their Business Brain**, and if they sign up, none of it is thrown away.

## Design rules

- **No login required to see the Snapshot.** Requiring an account before showing value contradicts Principle Zero — see [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md).
- **Every claim is falsifiable and correctable.** Nothing is presented as fact without a clear way to say "that's wrong."
- **Confidence is shown honestly.** If the scan couldn't find a signal (no public reviews, no discoverable GBP), the Snapshot says so plainly rather than guessing or leaving a blank.
- **No fabricated comparisons.** Competitor comparisons use only what's genuinely public; never invented data framed as real.
- **The Snapshot is not a sales page.** It's an honest read first, with a clear, low-pressure path to "want me to keep working on this?" second.

## Relationship to onboarding

The Snapshot is not a separate funnel stage that dead-ends into a generic signup form. Signup preserves the session; Guided Onboarding continues directly from what the Snapshot already learned and confirmed (see [`CUSTOMER_JOURNEYS.md`](./CUSTOMER_JOURNEYS.md#3-signup)). A prospect should never be asked, post-signup, for something they already told us during the Snapshot.

## Existing system note

This composes with, rather than replaces, the current website-analysis pipeline and AI Marketing Profile generation (see [`EXISTING_SYSTEM_AUDIT.md`](./EXISTING_SYSTEM_AUDIT.md)) — those already do authenticated-session website scanning and profile synthesis well. The Snapshot's job is to run an equivalent (lighter, public-only) version of that same intelligence *before* authentication, and hand off cleanly into the authenticated version rather than duplicating it.
