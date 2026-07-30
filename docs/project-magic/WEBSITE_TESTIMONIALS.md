# Project Magic — Website Testimonials

**Companion to:** [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) · [`BUSINESS_KNOWLEDGE_GRAPH.md`](./BUSINESS_KNOWLEDGE_GRAPH.md) · [`BUSINESS_LEARNING_ENGINE.md`](./BUSINESS_LEARNING_ENGINE.md) · [`SMART_UPLOADS.md`](./SMART_UPLOADS.md)

**Status:** Shipped — second Customer Voice provider, alongside Google Reviews.
**Branch:** `project-magic/website-testimonials`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

The objective of this sprint was **not** to build a testimonial management
system. It was to teach the Business Brain what customers consistently value
by learning from testimonial content already sitting on a business's own
website, in an inbox, or in a spreadsheet — content that predates this
platform and would otherwise never reach it.

## Provider architecture

Website Testimonials is the second implementation of the existing,
unchanged `CustomerVoiceProvider` interface
(`lib/customer-voice/providers/types.ts` — see `CUSTOMER_VOICE.md`):

```ts
interface CustomerVoiceProvider {
  id: CustomerVoiceProviderId;
  label: string;
  fetchEvidence(context: { userId; businessProfileId; now }): Promise<{ evidence: ProviderEvidenceInput[]; notes?: string[] }>;
}
```

`lib/customer-voice/providers/websiteTestimonials.ts` mirrors
`googleBusinessReviews.ts` exactly: a dependency-injected loader
(`WebsiteTestimonialsLoader`), a pure mapping function
(`mapTestimonialToEvidence`) into the shared `ProviderEvidenceInput` shape,
and an honest note (`"No website testimonials yet"`) when a business hasn't
added any. `CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS` was already
reserved in `lib/customer-voice/types.ts` before this sprint; this sprint
implements it rather than inventing a new id.

Because the abstraction was already fully provider-agnostic,
**`normalize.ts`, `compose.ts`, and `confidence.ts` required zero changes.**
`lib/customer-voice/service.ts::defaultProviders()` now returns both
providers, and every downstream consumer (theme extraction, confidence
scoring, `CustomerVoiceIntelligence`) treats testimonial evidence exactly
like review evidence — same themes, same sentiment analysis, same
`contributingProviders` attribution.

```
lib/testimonials/
  types.ts               Domain model: testimonial + knowledge-fact records
  bulkPaste.ts           Splits one pasted block into individual quotes
  csvImport.ts           RFC4180-ish CSV parser, flexible column naming
  websiteImport.ts       Regex-based quote/attribution extraction from fetched page text
  openai-extractor.ts    AI knowledge-fact extraction (structured JSON output)
  persistence.ts         CRUD against website_testimonials / testimonial_knowledge_facts
  service.ts             Ingest (manual/bulk/CSV/website) -> persist -> extract -> persist facts
  contentPromptBlock.ts  Adapters: knowledge facts / quotes -> Content Generator prompt blocks

lib/customer-voice/providers/websiteTestimonials.ts   Customer Voice provider
lib/business-knowledge-graph/adapters/testimonials.ts  Business Knowledge Graph adapter
```

### Ingestion methods (Part 1)

All four methods normalize into the same `RawTestimonialInput` shape
(`quote`, `authorName`, `authorTitle`, `sourceUrl`, `rating`,
`occurredAt`) before persistence — one persistence/extraction path
regardless of how the testimonial arrived:

- **Manual entry** — a single testimonial typed directly into the form.
- **Bulk paste** — `splitBulkPastedTestimonials` splits one large pasted
  block into individual quotes. It prefers an explicit `---`/`===`
  separator line when present, falls back to blank-line-delimited blocks,
  and as a last resort (no blank lines at all) treats each non-empty line as
  its own testimonial. Fragments under 10 characters are discarded as noise.
- **CSV import** — `parseTestimonialsCsv` is a hand-rolled, quoted-field
  state-machine parser (handles embedded commas and escaped `""` quotes,
  since testimonial text routinely contains both). Column names are matched
  flexibly (`quote`/`testimonial`/`review`, `author`/`name`/`customer`,
  etc. — see `COLUMN_ALIASES`) so a business's existing spreadsheet rarely
  needs reformatting. Rows missing a usable quote are skipped with a
  human-readable, row-numbered error, not a hard failure of the whole file.
- **Website import** — reuses `lib/website-analysis/fetcher.ts`'s existing
  `fetchWebsiteContentSafe` (no new fetcher written) to pull the already-live
  page text, then `extractTestimonialCandidatesFromPageText` finds quoted
  spans (curly or straight quotes, 40–600 characters) and an attribution
  line immediately following (`— Jane Smith, Property Manager`) with a plain
  regex — **no AI call at the detection stage**, keeping import fast and
  free. It never invents a quote: every candidate is a verbatim substring of
  the fetched page text, deduplicated case-insensitively.

CSV import is deliberately "future-ready": the same `RawTestimonialInput`
interface is what a future bulk-export-from-another-tool integration would
also produce — no format-specific type leaks past `csvImport.ts`.

## Extraction model

Part 2 asks for *reusable business knowledge*, not a summary of what a
testimonial says. `lib/testimonials/openai-extractor.ts::OpenAITestimonialExtractor`
follows the same pattern as `lib/smart-uploads/openai-extractor.ts`:
`responses.create` with a strict `json_schema` response format (model
`gpt-4.1-mini`), never free-text completion:

```json
{
  "items": [
    { "category": "trust_indicator", "fact": "...", "sourceExcerpt": "...", "confidence": "high" }
  ]
}
```

Nine categories are extracted when supported by the quote: customer
benefits, business strengths, recurring outcomes, objections overcome,
industry terminology, emotional language, trust indicators, differentiators,
and customer segments. The prompt instructs the model to extract discrete,
checkable facts and to return zero items for a category the quote doesn't
support — never fabricate. Model output is defensively normalized
(`normalizeTestimonialExtraction`): unknown categories and empty facts are
dropped, confidence defaults to `medium` when missing/invalid, and text is
truncated to a bounded length. Facts are persisted in
`testimonial_knowledge_facts`, replacing (never appending to) the prior set
for that testimonial on every re-extraction.

This AI extraction step runs identically regardless of ingestion method —
manual, bulk, CSV, and website-imported testimonials all go through
`extractAndPersistKnowledge()` in `lib/testimonials/service.ts`.

## Customer Voice integration (Part 3)

Testimonials are a first-class provider, not a bolt-on. Every place Customer
Voice reports evidence — themes, sentiment, `frequentlyMentionedServices`,
`strengths` — already tracks `contributingProviders` per theme, so once
`websiteTestimonials.ts` was wired into `defaultProviders()`, Google Reviews
and testimonials began reinforcing each other automatically:

- A theme mentioned in **both** a Google review and a testimonial reports
  both provider ids in `contributingProviders` and a higher `evidenceCount`.
- Confidence is calculated the same way regardless of which provider(s)
  contributed — no provider is treated as more or less trustworthy.

**Important fix made alongside this sprint:** `getCustomerVoiceIntelligence`
accepts an optional `knownServices` list that lets theme extraction
recognize a mentioned service *by name* (e.g. "commercial roofing"), which is
what lets Customer Voice evidence reinforce the *same* Business Knowledge
Graph entity another provider already supports, rather than only a generic
theme. This parameter existed before this sprint but was never actually
passed from `app/dashboard/page.tsx` — meaning service-specific theme
reinforcement silently never fired for **any** provider, including Google
Reviews. This sprint adds
`knownServices: businessDiscovery?.primaryServices?.value` to that call
site — a small, directly-related fix, since without it Part 4's
"testimonials reinforce existing conclusions" has no live path to actually
happen for service-level entities in production.

## Business Brain integration (Part 4 & 5)

Two complementary, non-overlapping reinforcement paths exist:

1. **Customer Voice theme reinforcement** (existing pipeline, now fully
   wired via the `knownServices` fix above) — when a testimonial and another
   provider both mention the same known service, Customer Voice's
   `customerVoiceToGraphSignals` adapter contributes a `reinforces` signal
   toward the **same** Business Knowledge Graph entity, raising
   `contributingProviderCount` and confidence on that conclusion.
2. **Testimonial knowledge-fact adapter**
   (`lib/business-knowledge-graph/adapters/testimonials.ts::testimonialKnowledgeToGraphSignals`)
   — maps each of the 9 extraction categories to a graph entity type
   (`CATEGORY_TO_ENTITY_TYPE`: e.g. `business_strength`/`differentiator` →
   `COMPETITIVE_STRENGTH`, `customer_segment` → `CUSTOMER_SEGMENT`,
   `industry_terminology` → `INDUSTRY`). These are genuinely new,
   subjective/trust-oriented entities — not the same graph-entity-type as a
   literal service name — so this adapter creates its own entities rather
   than force-fitting testimonial content onto unrelated existing
   conclusions. Every signal cites the real `source_excerpt` the fact was
   extracted from; nothing is fabricated.

Confidence only rises when **multiple independent providers** support the
same conclusion — this is existing, unmodified graph-merge logic
(`findOrCreateEntity` requires matching entity type *and* topic overlap
before merging), not new special-casing for testimonials.

**Business Learning Engine required zero new code.** The existing
`businessReasoningToLearningSignals()` adapter already produces a
stronger/higher-confidence learning signal whenever a Business Knowledge
Graph conclusion's `contributingProviderCount` rises — which testimonial
reinforcement now does. This is verified directly in
`unit-tests/website-testimonials.test.ts` (a testimonial-reinforced
conclusion produces a strictly stronger learning signal for the same
`patternKey`) rather than assumed.

## Growth Advisor (Part 6)

`lib/growth-advisor/observations.ts::testimonialWebsiteGapObservation`
looks for a Customer Voice theme with meaningful evidence (`evidenceCount >=
2`, not low confidence) whose words don't appear anywhere in the business's
own stated services/strengths (from Business Discovery) — i.e. something
customers keep saying that the business's own marketing doesn't emphasize:

> *"Customers consistently mention 'rapid response time,' but your website
> rarely emphasizes it."*

This observation is strictly gated on
`customerVoice.contributingProviders.includes("website_testimonials")` — it
never fires from Google Reviews evidence alone, since the mission's ask was
specifically about testimonial evidence surfacing a gap. Every observation
includes `whyItMatters`, matching the "always explain why" requirement.

## Content Generator (Part 7)

`lib/content-generator/contentPromptBlock.ts`-style adapters
(`lib/testimonials/contentPromptBlock.ts`) produce two distinct, clearly
labeled prompt blocks, both threaded into every content generation request
automatically (no manual prompting required) via
`lib/content-generator/service.ts` and `prompt-builder.ts`:

- **`formatTestimonialKnowledgeForContentPrompt`** — extracted knowledge
  facts grouped by category, the same style as Smart Uploads' knowledge
  block.
- **`formatTestimonialQuotesForContentPrompt`** — up to 2 real, verbatim
  testimonial quotes with honest attribution, excluding archived
  testimonials.

The system prompt gained one explicit rule, present everywhere content is
generated:

> "When real customer quotes are provided, only ever reuse them verbatim and
> attribute honestly — never invent a quote, never invent a customer story,
> never alter a quoted customer's words."

## Marketing Health (Part 8)

`lib/business-knowledge-graph/knowledgeHealth.ts` gains a 7th, additive
dimension — `customerUnderstanding` — alongside the existing 6 (this
extends, never touches, the Business Knowledge Graph health score; none of
the 3 pre-existing independent "Marketing Health" implementations were
modified). It rewards both **provider diversity** (up to 2 distinct Customer
Voice sources) and **evidence volume**, so a business with only Google
Reviews scores lower than one corroborated by both reviews and testimonials.
`buildMissingKnowledge()` now distinguishes "no customer sentiment at all"
from "reviews exist but no testimonials yet" — a more specific, more
actionable gap message.

## Business Connections

`ConnectionCapabilities.REVIEWS` is reused for the new
`conn_website_testimonials` catalog entry (category `CUSTOMER_FEEDBACK`)
rather than inventing a new capability, since both represent "customer
feedback" readiness. `resolveTestimonials` reports connected once at least
one active testimonial exists — a simple connected/not_connected mapping
(no `needs_attention` state, unlike some other providers, since there's no
meaningful "attention" state for a manually-curated list).

## Security & tenant isolation

- `website_testimonials` and `testimonial_knowledge_facts`
  (`supabase/migrations/035_website_testimonials.sql`) both enable RLS
  scoped to `auth.uid() = user_id`, with full select/insert/update/**delete**
  policies — unlike several append-only tables in prior sprints, a
  testimonial is a piece of content a business owner may legitimately want
  to remove, so deletion is a first-class, user-facing action
  (`DELETE /api/testimonials/[id]`), not just an internal retraction.
- Knowledge facts cascade-delete with their parent testimonial
  (`on delete cascade`) — removing a testimonial retracts every piece of
  extracted knowledge and every Business Brain observation sourced from it.
- Every persistence function is exercised in
  `unit-tests/website-testimonials.test.ts` against a fake Supabase client
  that records every `.eq()` call, proving reads/writes/deletes are always
  scoped to the given `userId` and never leak across tenants.

## Testing

`unit-tests/website-testimonials.test.ts` covers all four ingestion methods,
AI-output normalization, the Customer Voice provider (mapping, registration,
cross-provider reinforcement with real theme evidence), the Business
Knowledge Graph adapter (category mapping and an end-to-end test proving
`contributingProviderCount` and confidence rise with multi-provider
support), transitive Business Learning Engine strengthening, the Growth
Advisor gap observation (positive and negative cases), both Content
Generator prompt blocks, the new Marketing Health dimension, Business
Connections resolution, and tenant-isolated persistence.
`tests/website-testimonials.spec.ts` covers unauthenticated redirects/401s,
RLS policy presence (all four actions, both tables), provider-abstraction
purity (no provider-id branching in shared Customer Voice modules), that
Growth Advisor/Content Generator/Marketing Health actually reference the new
modules, the cron gate, and documentation coverage.

## Future roadmap

- Real CSV **file** upload (today's interface accepts pasted CSV text —
  the parser itself is already file-agnostic and ready for a multipart
  upload endpoint).
- Automatic, scheduled website re-import to catch new testimonials a
  business adds to their own site later (today's website import is a
  one-time, on-demand action).
- Video testimonial transcription (falls naturally under the existing Smart
  Uploads video-upload future work in `SMART_UPLOADS.md`, then flows through
  this same knowledge-extraction pipeline once transcribed).
- Manual "which quote is real" conflict surfacing if a future duplicate-
  content-across-providers detector is built (mirrors Smart Uploads'
  duplicate detection, not yet applied across Customer Voice providers).
- Per-testimonial verification badge (e.g. a business owner confirming a
  testimonial's authenticity) — the schema's `status` column already
  supports adding a verification state without a migration.
