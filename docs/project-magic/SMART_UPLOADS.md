# Project Magic 2.0 — Smart Uploads

**Companion to:** [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md)

Not every business has a connector available for the system that holds its most important data. A dentist's real customer history might live in a booking system with no API. A contractor's pricing might exist only in a PDF brochure. A restaurant's real customer feedback might be a folder of screenshots.

Smart Uploads is the fallback that ensures **no business is blocked from a richer Business Brain just because we haven't built their specific connector yet.**

---

## Supported input types

| Type | Examples of what it teaches the Business Brain |
|---|---|
| PDFs | Brochures, price sheets, service menus, past marketing materials |
| Excel / spreadsheets | Customer lists (aggregate patterns only — see Privacy below), sales reports, service catalogs |
| Word documents | Service descriptions, policies, FAQs, past proposals |
| Images | Photos of the physical business, menus, signage, before/after work examples |
| Videos | Walkthrough videos, testimonials, service demonstrations |
| Call transcripts | Real customer language — feeds [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) directly |
| Sales reports | Seasonal demand patterns — feeds [`SEASONAL_INTELLIGENCE.md`](./SEASONAL_INTELLIGENCE.md) |
| Customer lists | Aggregate demographic/geographic patterns, never used to contact anyone without separate, explicit consent |
| Service catalogs | Structured offering data that improves recommendation relevance |

## The experience

1. **Upload.** One drop zone, any supported file type, no format-picking required from the owner — the AI figures out what it's looking at.
2. **Processing.** A calm, honest "reading this now" state — never a raw progress bar with technical file-processing language.
3. **"I learned..."** After processing, the product states in plain language exactly what intelligence it gained:
   - *"I learned your most popular service is AC repair, and your pricing starts at $89."*
   - *"I learned three things your customers keep asking about in these call transcripts — I've added them to what I know about your business."*
   - *"I looked at these photos and found nothing I could use as marketing intelligence — that's okay, thanks for sharing them."*

The last example matters as much as the first two: **honesty about not learning something is as important as honesty about what was learned.** Never claim insight that wasn't actually extracted.

## Where it goes

Every successful extraction becomes a Business Brain observation, evidence-linked back to the specific upload (see [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md#layers-unchanged-model-broadened-content)) — the same evidence-linking discipline that already applies to connector-sourced data. An upload is not a second-class data source; once processed, it's indistinguishable in the Business Brain from data that arrived via a connector.

## Design rules

- **No format is a dead end.** If a file type genuinely can't be processed today, the product says so plainly and explains what *would* work, rather than silently failing or accepting the file and doing nothing with it.
- **Extraction confidence is honest.** A blurry photo, a scanned (non-OCR-friendly) PDF, or a garbled transcript may yield partial or no extraction — the "I learned..." message reflects that honestly rather than fabricating a confident summary.
- **Uploads never silently overwrite confirmed facts.** If an upload contradicts something the owner already confirmed (in the Snapshot, in onboarding, or in a prior upload), the product surfaces the conflict for the owner to resolve — it does not pick a winner silently. This mirrors the tone-persistence lesson from [`../RC1_AUTHENTICATED_PILOT_VALIDATION.md`](../RC1_AUTHENTICATED_PILOT_VALIDATION.md): shared, multi-consumer fields are never overwritten without the owner's clear intent.
- **Privacy discipline on customer lists.** Uploaded customer/contact lists are used for aggregate pattern learning (e.g., "most customers are within 8 miles," "repeat customer rate is high in spring") only — never for direct outreach without separate, explicit, informed consent. This is a hard boundary, not a configuration option.
- **File retention is transparent.** The owner can see what's been uploaded and remove it; removal also retracts any Business Brain observations sourced solely from that upload.

## Relationship to the Connector Framework

Smart Uploads is explicitly the **manual fallback** the Connector Framework (see [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md)) is designed to eventually make unnecessary for any given data type. When a real connector for a system ships, uploads from that category don't stop working — but the product should proactively suggest the connector as a lower-effort, always-fresh alternative to repeated manual uploads. Uploads answer "what if there's no connector yet"; connectors answer "how do we stop needing uploads at all."

---

# Implementation (this sprint)

**Status:** Shipped — PDF, DOCX, TXT, and Markdown, under Business Connections.
**Branch:** `project-magic/smart-uploads`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

This sprint ships the first slice of the vision above: document upload +
AI knowledge extraction for text-shaped files. Images, video, and call
transcripts remain future work (see "Future roadmap" below) — the
architecture is deliberately built so adding them later doesn't require
touching the extraction, persistence, or Business Brain wiring.

## Architecture

```
lib/smart-uploads/
  types.ts               Document / knowledge-fact domain model
  extractors/
    types.ts              DocumentTextExtractor interface
    plainText.ts           .txt / .md — real, no dependency
    docx.ts                 mammoth
    pdf.ts                   unpdf
    registry.ts             file type -> extractor lookup
  openai-extractor.ts     AI knowledge extraction (structured JSON output)
  duplicateDetection.ts   Cross-document duplicate/near-duplicate merging
  toBusinessInsight.ts    Adapter: knowledge fact -> shared BusinessInsight
  contentPromptBlock.ts   Adapter: knowledge facts -> Content Generator prompt block
  crossover.ts            Cross-provider reasoning (website gaps, Search Console demand)
  persistence.ts          CRUD against smart_upload_* tables (tenant-scoped)
  storage.ts              Supabase Storage wrapper (private bucket)
  service.ts              Upload / process / reprocess / delete orchestration

lib/embeddings/
  provider.ts             EmbeddingProvider interface + cosineSimilarity
  openaiProvider.ts       Concrete OpenAI implementation
  persistence.ts          smart_upload_fact_embeddings CRUD
  service.ts              generateEmbeddingsForFacts / findSimilarFacts
```

Upload flow:

```
POST /api/smart-uploads/documents (multipart)
        |
lib/smart-uploads/service.ts::uploadSmartUploadDocumentForCurrentUser
  - validates file type (pdf/docx/txt/markdown today) and size (<=15MB)
  - stores the original file in a private Storage bucket ("smart-uploads")
  - creates a smart_upload_documents row (status: uploaded)
  - queues a PROCESS_SMART_UPLOAD background job
        |
lib/background-jobs/worker.ts (PROCESS_SMART_UPLOAD case)
        |
lib/smart-uploads/service.ts::processSmartUploadDocumentForUser
  - downloads the file, picks an extractor by file_type (registry.ts)
  - extracts text -> lib/smart-uploads/openai-extractor.ts (AI knowledge extraction)
  - persists normalized facts (replacing any previous facts for that document)
  - runs duplicate detection across the whole business's knowledge
  - marks the document extracted (or failed, with a customer-safe error)
```

Reprocessing (`POST .../reprocess`) re-runs the same pipeline against the
already-stored file — it always *replaces* that document's facts rather than
appending, so reprocessing after a prompt/model improvement never leaves
stale duplicate facts behind.

Deleting a document (`DELETE /api/smart-uploads/documents/:id`) removes the
document row (facts cascade via foreign key — `on delete cascade`) and the
stored file from Supabase Storage. Any `BusinessInsight` built from that
document's facts (Growth Advisor, Content Generator, Weekly Growth Plan) is
retracted the next time those consumers read live data, since each insight
traces back to exactly one fact — the "removal retracts observations sourced
solely from that upload" design rule above, implemented literally.

### Future file types

`lib/smart-uploads/types.ts` already reserves `powerpoint`, `excel`, `image`,
and `csv` file types, and the migration's `file_type` check constraint
already allows them. Adding real support for any of them is exactly:
implement `DocumentTextExtractor` (`lib/smart-uploads/extractors/types.ts`)
and register it in `extractors/registry.ts` — no other file in the pipeline
changes. Images would additionally need an OCR step inside that extractor
(not implemented here) before `extractText` can return anything.

## Knowledge extraction

`lib/smart-uploads/openai-extractor.ts::OpenAIKnowledgeExtractor` follows the
same OpenAI call pattern as `lib/website-analysis/openai-extractor.ts`:
`responses.create` with a strict `json_schema` response format (model
`gpt-4.1-mini`), never free-text completion. The schema returns an array of
discrete facts, not a summary:

```json
{
  "items": [
    { "category": "service", "fact": "...", "sourceExcerpt": "...", "confidence": "high" }
  ]
}
```

Sixteen categories are extracted when supported by the text: product,
service, pricing, target_customer, geographic_market, unique_selling_point,
competitive_advantage, seasonal_offering, faq, terminology, guarantee,
certification, industry_served, call_to_action, brand_voice, important_date.

The prompt explicitly instructs the model to extract **reusable facts, not a
summary** — one discrete, checkable statement per item — and to return zero
items for a category the document doesn't support, never fabricate. Model
output is defensively normalized (`normalizeKnowledgeExtraction`): unknown
categories, empty facts, and malformed items are dropped; confidence
defaults to `medium` when missing; item count and text length are capped.

## Business Brain integration

Every knowledge fact is a normalized row in `smart_upload_knowledge_facts` —
not a raw AI summary blob. `lib/smart-uploads/toBusinessInsight.ts` adapts
one fact into the shared `BusinessInsight` contract (mirrors
`lib/customer-voice/toBusinessInsight.ts`), one fact producing exactly one
insight so deleting/superseding a fact retracts exactly the insight it
produced.

Consumers, all reading the same normalized facts (no separate representation
per consumer):

- **Growth Advisor** (`lib/growth-advisor/observations.ts`): cites a fact
  standalone when it's underrepresented on the website
  (`websiteContentGapObservation` — *"Your brochure highlights commercial
  roofing but your website has very little content targeting that."*), and
  cites a fact together with a Search Console demand signal when they cover
  the same topic (`searchDemandCrossoverObservation`).
- **Content Generator** (`lib/content-generator/`): every generation request
  automatically includes a compact, category-grouped knowledge block
  (`formatSmartUploadKnowledgeForContentPrompt`) in its prompt — no manual
  prompting required. Service descriptions, FAQs, social posts, and Google
  Business posts all draw from it the same way they already draw from
  Customer Voice.
- **Weekly Growth Plan** (`lib/growth-planner/evidence.ts`): a `smart_uploads`
  evidence item cites either the single highest-confidence fact, or — when a
  Search Console crossover exists — the same combined citation Growth
  Advisor uses.
- **Business Connections**: the previously-placeholder `conn_smart_uploads`
  catalog entry is now live; `resolveSmartUploads` reports connected once at
  least one document has been successfully extracted.
- **Future AI agents**: read `smart_upload_knowledge_facts` directly, or
  consume the same `BusinessInsight` adapter — no Smart-Upload-specific
  payload shape to learn.

## Search Console crossover reasoning

`lib/smart-uploads/crossover.ts::findSearchDemandCrossovers` pairs an upload
fact (product/service/USP) with a Search Console-derived
`search_demand_trends` insight covering the same topic, using an
overlap-coefficient match over topic words (stopwords and short filler words
excluded) — not a fabricated inference. The resulting observation/evidence
item quotes **both** sources' own text:

> "Organic clicks for 'commercial roofing' grew from 5 to 40 over the last
> period. Your uploaded documents also mention: 'We install and repair
> commercial roofing.'"

Growth Advisor and the Weekly Growth Plan both prioritize this crossover
citation ahead of either single-source citation when both are grounded in
the same topic, since two independent sources agreeing is stronger evidence
than either alone — the recommendation still never states a conclusion
neither source actually supports.

## Confidence model

Every knowledge fact carries:

| Field | Meaning |
|---|---|
| `confidence` | `low` / `medium` / `high`, set by the extraction model per-item |
| `document_id` | the source document (evidence link) |
| `date_learned` | when this fact was first extracted |
| `last_verified_at` | updated whenever the fact is reconfirmed |
| `category` | one of the sixteen knowledge categories |
| `superseded_by` | set when a later, corroborating/duplicate fact replaces this one |

### Duplicate merging

`lib/smart-uploads/duplicateDetection.ts::findDuplicateFacts` runs after
every extraction across the **whole business's** knowledge (not just the
newly processed document): facts in the same category with Jaccard
word-overlap similarity above `0.6` are considered duplicates. The
higher-confidence fact is kept; on a confidence tie, the more recently
learned fact wins. The older fact is marked `superseded_by` — never deleted
(preserves the audit trail of what was learned when) and excluded from every
consumer (`superseded_by == null` is the "active facts" filter used
everywhere: `contentPromptBlock.ts`, `crossover.ts`, and every
`toBusinessInsight.ts` caller). Two documents restating the same fact never
show up twice to a customer.

## Embedding abstraction

`lib/embeddings/provider.ts` defines a plain `EmbeddingProvider` interface
(`embed`, `embedBatch`, `id`, `dimensions`) with zero dependency on any
specific vendor. `lib/embeddings/openaiProvider.ts` is the only file that
imports the OpenAI SDK for embeddings (`text-embedding-3-small`, 1536
dimensions) — every other function in `lib/embeddings/service.ts` takes an
injected `EmbeddingProvider`, so unit tests use a deterministic fake and
never call a real embedding API.

`supabase/migrations/033_smart_uploads.sql` stores embeddings in
`smart_upload_fact_embeddings` with `provider_id` + `dimensions` columns —
rows from a future, different-dimensioned provider can coexist during a
migration without a schema change. Retrieval today
(`lib/embeddings/service.ts::findSimilarFacts`) is in-memory cosine-ranking
over a business's stored embeddings; swapping to a real ANN index (e.g. a
pgvector `<=>` query) later only changes that one function's implementation,
never its signature or callers.

This sprint ships the abstraction and the storage shape; it does not wire
automatic embedding generation into the upload pipeline (that would mean an
unconditional OpenAI embeddings call on every extracted fact, which is out of
scope for "design a provider abstraction"). `generateEmbeddingsForFacts` is
available for a future semantic-search feature to call explicitly.

## Security

- Every table (`smart_upload_documents`, `smart_upload_knowledge_facts`,
  `smart_upload_fact_embeddings`) enables RLS scoped to `auth.uid() =
  user_id`, matching every other integration table in this repo.
- The `smart-uploads` Storage bucket is private (`public: false`). Objects
  are stored at `{auth.uid()}/{document_id}/{file_name}` and Storage RLS
  policies check the first path segment against the caller's own uid — a
  customer can never read, list, or delete another tenant's files.
- File size is capped at 15 MB; only `pdf`/`docx`/`txt`/`markdown` are
  accepted today (validated by extension, checked against the same allowlist
  the extractor registry uses).
- Extraction errors are surfaced through the same `toSafeUserErrorMessage`
  pattern used elsewhere — OpenAI API errors never leak configuration
  details to the customer.
- Deleting a document removes both the DB row (and its facts, via cascade)
  and the stored file — nothing about a deleted document is retained.

## Testing

`unit-tests/smart-uploads.test.ts` covers extraction (extractor registry
selection, malformed-file error handling), AI-output normalization,
duplicate detection, the `BusinessInsight` adapter, the Content Generator
prompt block, both crossover shapes (website-content-gap and Search Console
demand), Growth Advisor and Weekly Growth Plan citation, Business
Connections resolution, tenant-isolated persistence (create/list/update/
delete/replace-facts), and the embedding abstraction (against a fake
provider — no live API calls). `tests/smart-uploads.spec.ts` covers
unauthenticated redirects/401s across every new route, RLS presence in the
migration, and that no client component leaks storage/service internals.

## Future roadmap

- Real OCR-based image extraction, video/call-transcript extraction, and
  PowerPoint/Excel/CSV extractors (architecture is ready — see "Future file
  types" above) — closing the gap to the full vision described earlier in
  this document.
- Wire `generateEmbeddingsForFacts` into the processing pipeline once a
  semantic-search UI exists to consume `findSimilarFacts`.
- Extend duplicate detection to consider embedding similarity (not just word
  overlap) once embeddings are generated automatically.
- Per-fact manual verification/correction UI (`last_verified_at` already
  supports "re-verified" without re-extracting).
- Multi-file batch upload.
- Conflict surfacing when an upload contradicts an already-confirmed fact
  (the "uploads never silently overwrite confirmed facts" design rule above)
  — today's duplicate detection merges same-category near-duplicates but
  does not yet detect direct contradictions (e.g. two different stated
  price points for the same service).
