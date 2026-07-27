# Implementation Note — First Impression

**Companion to:** [`SNAPSHOT_CONTINUATION_NOTE.md`](./SNAPSHOT_CONTINUATION_NOTE.md) · [`PUBLIC_SNAPSHOT_FOUNDATION_NOTE.md`](./PUBLIC_SNAPSHOT_FOUNDATION_NOTE.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`../BUSINESS_DISCOVERY_FIRST_IMPRESSION.md`](../BUSINESS_DISCOVERY_FIRST_IMPRESSION.md) (full UX, accessibility, mobile, analytics, and test detail)

A short note on how this phase fits together — read the full doc for detail.

## How this supports "Start with understanding, not forms"

A visitor's very first interaction with the product is typing one thing — their website address — not a multi-field intake form. Everything after that is us doing the work and them confirming or correcting it, never the reverse.

## How this supports "Explain before recommending"

Every insight on the results screen carries its real `reason` behind a "Why I think this" toggle before the visitor is ever asked to act on it. The three growth opportunities each state what was noticed and why it may matter before ever suggesting what to do about it — recommendation never arrives unexplained.

## How this supports "Preserve the illusion of simplicity"

DNS-safe fetching, the confirmation contract's tamper-resistance, TTL bookkeeping, rate limiting, and ownership claims — all of PR #74 and PR #75's backend complexity — are completely invisible here. What the visitor experiences is a short, honest conversation about their own business: what we found, how sure we are, and one plain question at a time about whether we got it right.

## How this closes the loop PR #75 opened

PR #75 shipped the confirmation contract and onboarding prefill wiring with an explicit "no final review UI" scope boundary. This phase is that UI: the actual screens where a visitor sees an Assumed insight, presses "That's right" or "Let me correct it," and later resumes that exact review inside authenticated onboarding via `SnapshotReviewStep`. No backend contract changed to make this possible — only two small, additive fields (visitor-input echo, a `degraded` flag) were added to the existing public result type.

## How this supports explicit user confirmation

Structurally enforced, not just observed: the only function in this UI capable of recording a decision (`handleDecide` in `snapshot-flow.tsx`) is called exclusively from an explicit button press on one specific insight. Viewing the results page, scrolling past an insight, or answering the page's one triage question ("Did I understand your business correctly?") never counts as a decision — a dedicated test asserts this against the source directly, not just observed behavior.

## How this supports the Grandparent Test and Five-Year-Old Test

No raw confidence tier name, confidence score, internal field name, or source enum value is ever rendered. "Assumed" becomes "My best understanding"; "ai_website_analysis" becomes "your website." A visitor who has never used a marketing tool in their life can read every word on this page.
