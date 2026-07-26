# Project Magic 2.0 — Product Decision Filter

**Companion to:** [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) · [`SCOPE_BOUNDARIES.md`](./SCOPE_BOUNDARIES.md)

This is the gate every feature proposal passes through before it reaches a roadmap, a design doc, or a line of code. It is not a scoring rubric — there is no partial credit. **Every question must be a genuine yes.**

---

## The five questions

### 1. Does this make the product easier?

Not "more powerful." Not "more complete." **Easier.** A feature that adds capability at the cost of one more decision, one more screen, or one more thing the owner has to learn is a net loss unless it also removes friction somewhere else.

*Ask:* After this ships, is there anything the customer now has to think about that they didn't before? If yes, what did we remove to pay for it?

### 2. Does this help the business grow?

Growth means: more customers, more revenue, better reputation, or meaningful time given back to the owner. "Interesting data" is not growth. "A more complete dashboard" is not growth unless it changes a decision the owner makes.

*Ask:* If this feature worked perfectly, what would be different about the business in three months? If the honest answer is "nothing outside the product," it fails this question.

### 3. Does AI automate meaningful work?

The feature should do work the owner would otherwise have to do themselves — not just display information faster or prettier than before. Reporting is not automation. Deciding, drafting, monitoring, and flagging on the owner's behalf is automation.

*Ask:* What task does this remove from the owner's plate? If the answer is "none, it just shows them something," it fails this question — unless what it shows is itself the decision-relevant output of automated work already done elsewhere.

### 4. Is this easy for a non-technical user?

No jargon, no configuration, no "connect your API," no concepts borrowed from software engineering, marketing agencies, or data science. If explaining the feature requires explaining how it works, it fails.

*Ask:* Could a business owner with no technical background and five minutes of attention use this without help? Would they need a support call?

### 5. Does this fit the Growth Engine vision?

The feature should serve the mission — understanding the business, its customers, its market, or its goals — not just the marketing vertical in isolation, and not an unrelated business function the mission doesn't cover. See [`SCOPE_BOUNDARIES.md`](./SCOPE_BOUNDARIES.md) for what's explicitly out of scope even under this broader mission.

*Ask:* Does this deepen the Business Brain's understanding of the business, or does it serve a goal outside that mission (accounting, payroll, legal, HR)?

---

## The gate

If **any** answer is no:

> **Do not build it.**

Not "build it smaller." Not "build a v1 and revisit." The filter exists precisely to stop good-sounding ideas that don't earn their place. A feature that fails the filter today can be revisited later if the underlying constraint changes (a new connector makes it feasible, a customer research finding changes the growth case) — but it does not get grandfathered in by momentum, sunk cost, or "we already started."

---

## Worked examples

| Proposal | Easier? | Grows business? | AI automates work? | Non-technical? | Fits Growth Engine? | Verdict |
|---|---|---|---|---|---|---|
| Auto-draft Google Business Profile posts from the plan | Yes | Yes | Yes | Yes | Yes | **Build** |
| A raw SQL query console for customers to explore their own data | No | No | No | No | Partial | **Do not build** |
| Payroll and HR management inside AJN Marketing | — | — | — | — | No | **Do not build** — out of mission |
| Smart Uploads: extract intelligence from an uploaded price sheet | Yes | Yes | Yes | Yes | Yes | **Build** |
| A configurable dashboard-builder with drag-and-drop widgets | No | Unclear | No | No | Partial | **Do not build** |
| Weekly forecast of a seasonal opportunity, with one recommended action | Yes | Yes | Yes | Yes | Yes | **Build** |
| A full CRM replacement (contact management, pipelines, deal stages) | — | — | — | — | No | **Do not build** — adjacent product, not growth intelligence (see [`SCOPE_BOUNDARIES.md`](./SCOPE_BOUNDARIES.md)) |

---

## Who applies the filter

Anyone proposing a feature — human product owner, engineer, designer, or AI agent operating autonomously on the roadmap — runs the proposal through these five questions **before** writing a plan or a spec, not after. A plan that already has code attached is much harder to say no to; the filter is designed to be applied early, when saying no costs nothing.
