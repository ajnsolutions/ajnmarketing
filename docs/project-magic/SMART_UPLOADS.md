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
