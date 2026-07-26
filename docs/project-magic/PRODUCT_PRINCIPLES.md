# Project Magic 2.0 — Product Principles

**Companion to:** [`MANIFESTO.md`](./MANIFESTO.md) · [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md) · [`../PROJECT_MAGIC_MANIFESTO.md`](../PROJECT_MAGIC_MANIFESTO.md) (1.0 core philosophy table — still in force, not repeated in full here)

Every principle below has a **test** attached. A principle without a test is a slogan. We don't ship slogans.

---

## Principle Zero

> **Complexity belongs to us. Simplicity belongs to the customer.**

This is the principle every other principle exists to enforce. If a design decision ever makes the *product* simpler at the cost of making the *customer's experience* more complex, that decision is backwards. We absorb the complexity. Always.

**Test:** Can you describe what the customer needs to do, this week, in one sentence with no technical terms? If not, the complexity leaked.

---

## Guided Experience

The product always tells the customer what to do next. It never presents a blank canvas, an empty state with no direction, or a menu of equally-weighted choices and asks the customer to figure out where to start.

**Test:** On any screen, can the customer answer "what should I do right now?" without reading anything except the one highlighted action?

---

## Marketing Memory / Business Brain

Everything the product learns about a business is remembered, structured, and reused — never re-asked, never forgotten between sessions, never siloed inside one feature. See [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md).

**Test:** If a customer already told us something (in onboarding, in an upload, in a review reply, in a connector), does any later screen ever ask them again?

---

## Customer Voice

Reviews, calls, messages, and support conversations are language, not numbers. We read them for meaning — themes, sentiment, objections, praise, comparisons — never just count or star-average them. See [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md).

**Test:** Could the underlying insight have been produced by a `COUNT()` and an `AVG()`? If yes, we haven't actually understood the customer voice yet.

---

## Market Radar

The business's competitive and market context is continuously monitored, not reviewed once at onboarding and forgotten. See [`MARKET_RADAR.md`](./MARKET_RADAR.md).

**Test:** If a named competitor changes something publicly today, does the Business Brain know within a reasonable cycle — without the owner telling us?

---

## Seasonal Intelligence

Timing matters as much as content. Recommendations that could have been made earlier, using known seasonal patterns, are late recommendations. See [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md).

**Test:** Could a competitor who started this campaign last week beat the business to the season? If a forecastable pattern predicted that risk, did we surface it in time to act?

---

## Forecasting

Every forecast is stated as a forecast — with a confidence level, a reasoning trail, and an honest acknowledgment of uncertainty. Never a guarantee dressed as a prediction.

**Test:** Does the copy ever imply certainty ("will," "guaranteed") about a future event we don't control? If so, rewrite it as a forecast ("likely," "based on last year," "worth watching for").

---

## Living Market Intelligence

The Business Brain's understanding of the market is a living model that updates continuously, not a report generated once and left stale. Anything presented as current must actually be current, or must say when it was last refreshed.

**Test:** Does any screen present market/competitor information without a visible "as of" freshness signal?

---

## Connector Framework

New data sources are additive, not disruptive. Adding a new connector category should never require redesigning the Business Brain, the dashboard, or the onboarding flow. See [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md).

**Test:** Can a new connector be added by writing to an existing contract (auth, sync, health, revoke) rather than inventing a new integration pattern?

---

## Business Goals

Every recommendation, forecast, and Business Pulse signal traces back to a goal the *owner* set or confirmed — never a goal the product invented on the business's behalf.

**Test:** Can you name the specific business goal a given recommendation serves? If the honest answer is "growth in general," the recommendation isn't specific enough to ship.

---

## Product Decision Filter

See the full document: [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md). Every feature must pass all five questions before it's built.

---

## The Grandparent Test

If a customer's grandparent — someone with no technical background, no patience for jargon, and no interest in "how it works" — can't understand what a screen is telling them or what it's asking them to do, the screen fails, regardless of how sophisticated the underlying intelligence is.

**Test:** Read the screen's primary copy out loud to someone unfamiliar with the product. Do they understand it on the first read?

---

## The Five-Year-Old Test

If a five-year-old, hearing the feature described out loud, would ask "wait, why?" and the honest answer is "because it's technically interesting" rather than "because it helps the business owner," the feature doesn't belong in the customer experience.

**Test:** Can the feature's value be explained in one sentence a child would accept as a good reason?

---

## One Question Per Screen

Never ask for more than one decision, one piece of information, or one confirmation on a single screen. Batch-asking is homework. Sequential, single-question flows feel like a conversation.

**Test:** Count the number of distinct decisions a screen requires before the customer can move on. If it's more than one, split the screen.

---

## The 30-Second Rule

Any routine customer task — a weekly review, an approval, a setup step — should be completable in 30 seconds of actual attention. Not 30 seconds of reading; 30 seconds of *deciding*. If the product has already done the thinking, the customer's job is to glance and confirm.

**Test:** Time a first-time user completing the task with no prior context. If it takes meaningfully longer than 30 seconds and the delay isn't the customer thoughtfully editing content, redesign it.

---

## How these principles resolve conflicts

When two principles appear to conflict (for example, Guided Experience wants to surface a recommendation now, but Seasonal Intelligence's confidence is still low), **Principle Zero wins by default**: whichever resolution keeps complexity on our side and simplicity on the customer's side is correct. When genuinely unclear, escalate to a human product decision — do not let an AI agent or automated system resolve principle conflicts silently.
