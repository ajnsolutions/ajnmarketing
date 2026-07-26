# Project Magic 2.0 — Customer Voice

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md)

Customer Voice is the discipline of **understanding**, not counting, what a business's actual customers say. It's one of the clearest expressions of the difference between a marketing tool and a Growth Engine: a tool shows you a star rating; a Growth Engine tells you *why* that rating is what it is and what to do about it.

---

## Sources

| Source | Status | Notes |
|---|---|---|
| Reviews | Exists (public read) | Currently read for reply-drafting; theme/sentiment extraction is new depth |
| Call intelligence | New | Requires a Communication connector or call-transcript Smart Upload |
| Messages | New | Platform messages (for platform businesses), SMS, or connected messaging channels |
| Emails | New | Customer-facing email threads, where connected |
| Support conversations | New | Any support/help channel the business uses |

## What "understanding" means, concretely

Never simply count. Every Customer Voice source is analyzed for:

- **Themes** — recurring topics customers bring up, unprompted
- **Sentiment** — not a single aggregate score, but sentiment *attached to a theme* ("customers are happy with response time, frustrated with pricing clarity")
- **Questions** — what customers keep asking that the business's public presence doesn't already answer clearly (a direct signal for what the website/GBP/FAQ should say)
- **Praise** — specific, quotable things customers love, useful for both marketing copy and morale
- **Objections** — what makes a customer hesitate, sourced from real language, not guessed
- **Competitor comparisons** — when customers mention alternatives, what they say about them

## The "never simply count reviews" rule

A star average and a review count are the lowest-value read of customer language available, and yet they're what most marketing tools stop at. Customer Voice's entire reason for existing is to go past that: two businesses with an identical 4.3-star average can have completely different underlying stories (one is "consistently good, slow to respond," the other is "excellent service, confusing pricing") — and only one of those stories tells the owner what to actually fix.

**Test (from [`../PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md)):** Could the insight have been produced by a `COUNT()` and an `AVG()`? If yes, it isn't Customer Voice yet — it's just review data.

## Where it feeds

- **Marketing Director** — theme/objection data becomes recommendation-relevant evidence (e.g., "customers keep asking about financing options" → a recommendation to add financing messaging)
- **Business Pulse** — Customer Voice health (are themes trending positive or negative?) becomes a Business Pulse input, distinct from raw review-reply-latency (which Marketing Health already tracks)
- **Free Marketing Snapshot** — public review theme/sentiment reading is part of "What Customers See" from day one, before signup

## Design rules

- **Attribution stays honest.** A theme extracted from three reviews is presented as "a few customers mentioned..." not "customers say..." — magnitude language must match actual signal volume.
- **No customer is ever identifiable in aggregate output.** Themes and sentiment are presented in aggregate; individual customer identities from calls/messages/support conversations never surface in a recommendation or report without being genuinely necessary and consented to (e.g., a specific named review the owner is being shown to reply to).
- **Negative signal is delivered calmly, per [`UX_RULES.md`](./UX_RULES.md) and [`../MARKETING_HEALTH.md`](../MARKETING_HEALTH.md)'s messaging rules** — "here's what customers are frustrated about, and here's what I'd recommend" — never alarmist framing.
