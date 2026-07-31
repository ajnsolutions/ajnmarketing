# Business Brain Inspector

A customer-facing trust feature. It answers the question every customer eventually
asks: **"Does the AI actually understand my business?"** — not by adding a new AI
call or a new reasoning engine, but by composing what every existing Business Brain
subsystem has already computed into one honest, explainable page.

This is **not** a debugging page. Nothing on it is a raw payload, an internal score,
or a percentage. Every statement traces back to a real evidence source, and anything
the Business Brain doesn't know yet is named as a gap, never silently omitted.

## Architecture

```
Business Discovery ─┐
Customer Voice ──────┤
External Intelligence┤
Opportunity Engine ──┼──▶ adapters/*.ts ──▶ KnowledgeCard[] ──▶ build.ts ──▶ BusinessBrainSnapshot ──▶ BusinessBrainPage
Goals ────────────────┤                                              │
Business Learning ───┘                                    missingKnowledge.ts
                                                            (Business Discovery gaps +
                                                             Business Knowledge Health gaps)
```

- **`lib/business-brain-inspector/types.ts`** — the shared contract: `KnowledgeCard`,
  `MissingKnowledgeItem`, `BusinessBrainSnapshot`, the 12 `BrainSections`, and the
  `BrainConfidenceLevel` vocabulary.
- **`lib/business-brain-inspector/confidence.ts`** — maps every subsystem's own
  confidence vocabulary onto the shared High/Medium/Low scale.
- **`lib/business-brain-inspector/adapters/*.ts`** — one adapter per Business Brain
  source. Each adapter *only reshapes* that source's own already-computed output into
  `KnowledgeCard[]` — it never re-derives, re-scores, or fabricates anything.
- **`lib/business-brain-inspector/missingKnowledge.ts`** — unifies Business
  Discovery's `missingInformation` and the Business Knowledge Graph's
  `missingKnowledge` gaps into one deduplicated, explained, correctable list.
- **`lib/business-brain-inspector/build.ts`** — pure composition, no I/O. Aggregates
  every adapter's cards, groups them by section, and computes an overall confidence
  from the cards themselves (never reusing a different subsystem's own composite
  score under a new label).
- **`lib/business-brain-inspector/service.ts`** — the one server entrypoint.
  Fetches the same Business Brain packages the dashboard already assembles, reasons
  across them the same way (via the existing Business Knowledge Graph and Business
  Learning Engine), and calls `buildBusinessBrainSnapshot`. No second fetch of raw
  provider data.
- **`components/dashboard/business-brain-page.tsx`** + **`app/dashboard/business-brain/page.tsx`**
  — the customer-facing page and its route, at `/dashboard/business-brain`.

## Knowledge model

A `KnowledgeCard` is one thing the Business Brain currently believes:

```ts
type KnowledgeCard = {
  id: string;
  section: BrainSectionKey;
  title: string;
  statement: string;          // what the AI believes, in plain language
  confidence: BrainConfidenceLevel;
  confidenceReason: string;   // why, specifically — never a bare label alone
  evidenceCount: number;
  evidence: BrainEvidenceRef[];
  correction: BrainCorrectionAction | null;
};
```

Cards are grouped into 12 sections, in a fixed customer-reading order: **Business
Identity, Products & Services, Ideal Customers, Geographic Service Area,
Differentiators, Brand Voice, Customer Themes, Search Trends, Seasonality,
Marketing Opportunities, Business Goals, Learning History.**

A section only renders if it has at least one card. There is no placeholder card for
an empty section — an empty section simply doesn't appear, and anything missing from
it that matters shows up in the Missing Knowledge list instead.

## Confidence model

Every subsystem in this repo already tracks its own confidence:

| Subsystem | Native vocabulary | Maps to |
|---|---|---|
| Business Discovery | `known` / `assumed` / `missing` | `high` / `medium` / *(no card)* |
| Customer Voice, External Intelligence, Business Knowledge Graph, Business Learning Engine, Opportunity Engine | `low` / `medium` / `high` | passthrough |

`confidence.ts` maps every one of those onto the single **High / Medium / Low**
vocabulary the mission calls for. Business Discovery's `missing` tier produces no
card at all — that information belongs in the Missing Knowledge list, not a
confidence-less card.

The **overall confidence** shown at the top of the page is computed independently
from every card the Inspector actually built (`overallConfidenceFrom`), by ranking
low/medium/high as 1/2/3, averaging, and flooring — never rounding up. A handful of
weak cards can't be masked by many strong ones, and the number is never shown as a
raw percentage or score.

## Evidence attribution

Every card carries a `BrainEvidenceRef[]`:

```ts
type BrainEvidenceRef = {
  sourceProviderId: string;  // opaque, stable id (e.g. "search_console")
  sourceLabel: string;       // customer-facing label (e.g. "Search Console")
  summary: string;           // plain-language pointer to the specific evidence
};
```

Every adapter reuses the evidence its source already tracked — Business Discovery's
`DiscoveryEvidenceRef`, Customer Voice's contributing providers, External
Intelligence's and the Opportunity Engine's own `evidence[]`, the Business Learning
Engine's `PatternEvidence[]`. No adapter invents an evidence entry that its source
didn't already produce.

## Correction workflow

Part 5 of the mission is explicit: **do not create a parallel editing system.** Every
`KnowledgeCard` and `MissingKnowledgeItem` carries an optional `BrainCorrectionAction
{ label, href }` that points at a real, already-existing settings/onboarding
destination — Business Setup, the AI Marketing Profile, Customer Voice, Website
Testimonials, Search Console, Smart Uploads, Goals & Strategy, Business Connections,
or the Growth Advisor itself. Clicking "This isn't quite right? …" takes the customer
to the actual place they'd fix it — no new database table, no new form, no
duplicated editing surface.

## Growth Advisor & Marketing Health integration

- **Growth Advisor (Part 6):** `confidenceGapObservation` in
  `lib/growth-advisor/observations.ts` reuses the exact same
  `BusinessKnowledgeHealth.missingKnowledge` list the Business Brain page and
  Marketing Health already show, and surfaces the single most impactful actionable
  gap as the lowest-priority "What I Noticed" observation — e.g. *"I'd have higher
  confidence in future recommendations if you connected Google Search Console."*
  Gaps with no clean single action (e.g. conflicting signals) are intentionally
  excluded rather than forced into a misleading "connect X" phrasing.
- **Marketing Health (Part 7):** the Marketing Health coaching card in
  `components/dashboard/growth-advisor/supporting-context.tsx` links directly to
  `/dashboard/business-brain` — *"See what evidence is missing in your Business
  Brain →"* — so a low-confidence explanation always has a place to go deeper,
  reusing the existing Marketing Health data rather than a second scoring system.

## Business Timeline milestones

Part 8 adds four **summary-level** milestone types to
`lib/business-timeline/types.ts` and `lib/business-timeline/build.ts`:

| Type | Fires when | Why it's distinct from existing entries |
|---|---|---|
| `business_understanding_improved` | A Business Knowledge Graph conclusion is corroborated by 2+ providers | Genuinely new — BKG conclusions were never in the timeline before |
| `customer_voice_strengthened` | A theme in `frequentlyMentionedServices` reaches 3+ pieces of evidence | Uses a different theme list than the existing `customer_voice_milestone` entries (which use `.strengths`), avoiding duplication |
| `search_confidence_increased` | Overall External Intelligence confidence is `high` | One summary entry, not per-insight (the existing `search_milestone` already covers individual trends) |
| `learning_confidence_improved` | Overall Learning Maturity score reaches 70+ | One summary entry, not per-pattern (the existing `learning_milestone` already covers individual patterns) |

None of these subsystems persist historical snapshots, so there's no true "before vs.
after" delta to measure. Each milestone fires only when the *current*,
already-computed state genuinely clears a real bar — presented honestly as a
milestone, never a fabricated trend claim.

## Provider integration (Part 9)

Adding a new Business Brain source requires exactly one new file: an adapter
function that turns that source's own output into `KnowledgeCard[]`, registered in
`build.ts`'s `allCards` array. No change to `types.ts`, no change to the page
component, no change to any other adapter. `build.ts` never branches on a specific
`sourceProviderId` — it only knows the shared `KnowledgeCard` shape.

## Testing

- **Unit tests** (`unit-tests/business-brain-inspector.test.ts`): the confidence
  mapping, every adapter's card-building rules (including the evidence-count floors
  that keep a single mention from becoming a claim), `buildMissingKnowledge`'s
  dedup, `buildBusinessBrainSnapshot`'s section grouping and overall-confidence
  math, the Growth Advisor confidence-gap observation, and all four Business
  Timeline milestone functions (including their negative cases — no milestone fires
  when the bar isn't cleared).
- **Playwright** (`tests/business-brain-inspector.spec.ts`): source-level wiring
  checks confirming every module, the page, the route, and this document exist;
  that all 12 sections and the High/Medium/Low vocabulary are present; that
  corrections route to real existing pages; that the Growth Advisor, Marketing
  Health, and Business Timeline integrations are wired; and that
  `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Future roadmap

- **Historical confidence trends.** Once a subsystem starts persisting periodic
  snapshots (rather than always computing fresh), the Business Timeline milestones
  above could become true before/after deltas instead of bar-crossing events.
- **Inline corrections for simple text fields.** Today every correction routes to
  an existing settings page. A future iteration could let a customer correct a
  single short field (e.g. "this isn't one of our services") without leaving the
  Business Brain page, still writing through the same existing persistence layer
  Business Discovery already reads from — never a parallel store.
- **Section-level confidence.** Today confidence is per-card and one overall
  number. A per-section rollup (e.g. "Customer Themes: Medium") could help a
  customer prioritize which area to strengthen first.
- **New provider adapters.** Any future Business Brain source (a new connector, a
  new intelligence engine) plugs in by adding one adapter file — see "Provider
  integration" above.

## Known limitations

- Confidence and evidence counts are read at request time; there is no persisted
  history of how confidence changed over time beyond the Business Timeline
  milestones described above.
- The Missing Knowledge list can only name gaps that Business Discovery or the
  Business Knowledge Graph already detect — a genuinely new category of gap needs a
  change in one of those two systems first, not in the Inspector itself.

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` — this feature introduces no
new scheduled job.
