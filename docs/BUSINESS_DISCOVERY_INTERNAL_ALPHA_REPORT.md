# Business Discovery — Internal Alpha Readiness Report

**Status:** Intelligence-quality pass over the existing Business Discovery pipeline and First Impression UI — no new customer-facing features
**Branch:** `project-magic/2-0-wave1-alpha-intelligence`
**Scope:** Parts 1–8 of the Internal Alpha sprint — heuristic review, a new evaluation dataset/framework, summarization/explainability/growth-opportunity improvements, confidence-scoring review, First Impression copy review, and this report.
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## Part 1: Pipeline review — what was weak, and what changed

Business Discovery (`lib/business-discovery/`) is a pure aggregation layer — it never itself extracts or infers anything. The actual intelligence lives one layer down, in `lib/website-analysis/` (website extraction) and `lib/ai-marketing-profile/` (marketing profile synthesis), both of which run an OpenAI call when `OPENAI_API_KEY` is configured and fall back to a deterministic, keyword/template-based heuristic path otherwise. **The heuristic fallback path is where nearly every weakness lived**, because it is what actually runs in this environment (no API key configured) and in any production failure/timeout of the OpenAI call.

### Industry detection — did not exist

There was no industry classifier anywhere in the codebase. "Industry" was either owner-entered free text, an unconstrained LLM string field, or one of two **inconsistent hardcoded fallback strings** ("Local Service Business" in `extractor.ts`, "Local Business" in `placeholder-generator.ts`) whenever nothing else was available.

**Fixed:** added `lib/business-discovery/industryTaxonomy.ts` — a deterministic, frequency-scored keyword classifier covering the 11 categories named in this sprint (HVAC, Roofing, Dental, Restaurant, Legal, Insurance, Consulting, Marketing Agency, SaaS, Ecommerce, Coaching). Every category's fallback industry, persona, brand personality, common objections, and growth opportunities now read this classifier instead of falling to a generic string. The two inconsistent fallback constants were unified into one (`GENERIC_INDUSTRY_FALLBACK`).

### Target customer / persona detection — a real bug, not just a weak heuristic

`lib/website-analysis/customer-persona.ts`'s B2B persona matcher (`B2B_PERSONA_CANDIDATES`) picked the **first candidate in array order** that had any matching term at all — not the most-supported one. A page mentioning both "employer" and "healthcare" always got whichever candidate happened to be earlier in the list, regardless of which term actually dominated the page. Confirmed and fixed: matching is now scored by how many of a candidate's terms are actually present, and the highest-scoring candidate wins.

**A second, more consequential bug was found via the eval dataset** (see Part 2): the healthcare/benefits candidate's term list included the bare word **"insurance agency"** — meaning any general auto/home/life insurance agency's website got misclassified as a B2B employee-benefits consultant persona, purely because "insurance agency" appeared in its own name. Fixed by removing that overly broad term; "health plan"/"medical plan"/"healthcare" remain, since those are actually specific to benefits consulting.

When neither the B2B nor the residential keyword checks fire, the code previously jumped straight to a generic catch-all string (`LOW_CONFIDENCE_CUSTOMER_PERSONA`, literally "Business decision-makers and customers described on the website") for *every* business that didn't mention "homeowner" or a benefits-related term — which, before this sprint, meant every dentist, restaurant, law firm, insurance agency, consultant, agency, SaaS product, ecommerce store, and coach. Added an industry-aware persona layer keyed off the new classifier, tried before that catch-all.

**A pre-existing honesty bug was also found and fixed**: this generic catch-all string was still being scored as a genuine "Assumed" (55/100) insight in the confidence system, indistinguishable from a real inference — presenting "we have no real signal" as if it were "we made an educated guess." See Part 6.

### Business summary and executive summary generation — generic templates

The heuristic fallback's `executiveSummary` was a single fixed template — `"{name} presents as a trusted, locally focused {industry} serving {city}. The website provides a foundation for local SEO..."` — identical marketing-brochure phrasing regardless of what the business actually does. Fixed to state the actual detected services when available, and to be honest (not confidently vague) when no services were detected at all.

### Brand personality and common objections — the fallback was three words

The no-API-key brand personality fallback was `[tone, ...preferred_words, "Trustworthy", "Helpful", "Clear"]` — three of six traits were the same fixed adjectives for every business that ever hit this path. `common_objections` was **always** the same three generic sentences, unconditionally, for every business. Both are now industry-aware banks (e.g. a dental practice gets "Reassuring, Gentle, Professional" and "Patients worry about cost and whether insurance is accepted"; a SaaS product gets "Efficient, Modern, Clear" and "Buyers aren't sure the switching cost is worth it").

### Growth opportunities — the most generic surface in the whole pipeline

The fallback `highestRoiImprovements` was: "Add FAQ sections to top service pages" / a city-landing-page suggestion / "Implement LocalBusiness schema markup" — 2 of 3 items identical for every business, regardless of industry. `seasonal_opportunities` was three fixed campaign-name strings ("Quarterly service spotlight campaign," etc.) whenever the owner hadn't entered seasonal services.

**Fixed**: built `lib/business-discovery/growthOpportunityEngine.ts`, an industry-aware, evidence-gated opportunity generator (see Part 5 for detail on the design). This replaces both fallbacks.

### A real functional bug found via the eval dataset, unrelated to heuristic quality

`extractHeadings()` in `extractor.ts` reused a shared `matchAll` helper that returns each regex match's *full matched string* rather than the captured group — for a pattern like `<h2>([^<]+)</h2>`, that meant the literal text `"<h2>Furnace Repair</h2>"`, tags included, was flowing into `primaryServices`, `executiveSummary`, and generated content-opportunity titles for every business using the heuristic path. This is not a "weak heuristic" — it is a bug that would have shown visible HTML markup to real customers. Found by building the eval dataset and eyeballing real output (see Part 2), not by code review — this is exactly the value the eval framework is meant to provide going forward. Fixed, with a regression test locking it in (`unit-tests/website-analysis-extractor.test.ts`).

### Content opportunity "SEO scores" — fabricated precision

`content-opportunities.ts` generated a `seoScore` number (e.g. 88, 85, 82) for every content idea that was, in the neutral-topic path, purely `86 − 3×(list position)` — no relationship to any real SEO signal, just decay-by-index dressed up as a metric. Also, its 4-pattern title-template rotation repeated the exact same pattern twice ("A Practical Guide to X" at both position 0 and 3). Fixed: the score now derives from whether the topic is a primary service, secondary service, or incidental keyword (more central to the business → higher score) rather than bare list position, and the duplicate template was replaced with a distinct one ("X: Common Questions, Answered").

### `shortenAudience`'s over-aggressive truncation — found and fixed via the eval dataset

While validating the new industry-aware personas, the eval suite caught that `content-opportunities.ts`'s `shortenAudience()` helper bailed straight to the generic "Their Customers" label whenever a persona was longer than 48 characters *and* had no comma/period to split on — which most of the new, more specific personas did (e.g. "Individuals and businesses seeking legal guidance or representation for a specific matter"). A real, specific persona was being discarded for the exact generic fallback this sprint exists to eliminate. Fixed with clean word-boundary truncation instead of an all-or-nothing bail-out.

---

## Part 2: Evaluation dataset and regression framework

**Before this sprint, there was no golden dataset anywhere in the repository** — no sample-business corpus, no recorded website content used for regression testing of extraction quality. Every existing Business Discovery test constructed synthetic, already-merged data by hand; none of them ran real website content through the actual extraction/persona/growth-opportunity code.

**Built:**
- `eval/business-discovery/fixtures.ts` — 12 fixtures, one per category named in this sprint: HVAC, Roofing, Dentist, Restaurant, Attorney, Insurance, Consultant, Marketing Agency, SaaS, Ecommerce, Coach, and the AJN Sports Coach profile specifically. Each pairs realistic (fictional) website copy and HTML structure with the onboarding profile fields a real customer might supply, plus explicit expectations (industry classification, persona pattern, summary content, growth-opportunity relevance).
- `unit-tests/business-discovery-eval-regression.test.ts` — runs every fixture through the real, deterministic `PlaceholderWebsiteExtractor` and asserts every expectation. Runs automatically as part of `npm run test:unit` — no API key, no network, no cost. This is the repeatable regression framework: a future change that degrades industry detection, persona quality, or growth-opportunity relevance for any category fails a test immediately instead of only being noticed in a live demo.
- `eval/business-discovery/runEval.ts` — a human-readable companion script (`node --import ./unit-tests/support/register.mjs eval/business-discovery/runEval.ts`) that prints the actual generated industry, persona, summary, and growth opportunities per category, for manual review while iterating on heuristics.

This dataset caught three real, previously-unknown bugs on its first run (the insurance/healthcare persona misclassification, the `shortenAudience` truncation bug, and the `extractHeadings` markup leak) — see Part 1. That is the dataset doing exactly its job.

---

## Part 3: Summarization improvements

- Executive summaries in the heuristic path now name actual detected services rather than a fixed "trusted, locally focused" template.
- Business summaries stay honest when there is genuinely nothing to summarize, rather than confidently describing "a foundation for local SEO" regardless of input quality.
- Every summary and reason string is now industry-aware wherever industry can be classified, rather than uniformly generic.

---

## Part 4: Explainability improvements

`buildResult.ts`'s `evidencePhrase()` (the function that fills in the "because ___" clause of every reason sentence) previously joined at most 2 evidence details with "and," with no signal about how many independent sources actually agreed. It now:
- Includes up to 3 evidence details, not 2.
- When 2+ distinct sources corroborate a field, explicitly says so ("2 signals agreeing — ...") rather than reading identically to a single unconfirmed guess.

This is a systemic fix — every one of the 7 fields that use the shared `buildInsight` helper (business summary, primary services, target customers, brand personality, unique strengths, competitive position, growth opportunities) benefits from it automatically, not just one field patched in isolation.

The "Why I think this" disclosure in the First Impression UI already surfaced each insight's real `reason` field (never chain-of-thought or raw prompts) — that discipline was already correct and is unchanged.

---

## Part 5: Growth opportunity improvements

`lib/business-discovery/growthOpportunityEngine.ts` replaces both fixed boilerplate lists with an industry-aware, evidence-gated generator:

- **Specific**: each opportunity is a concrete action ("Add a maintenance-plan page," "Make your menu the most prominent link on your homepage"), not a category label.
- **Supported**: every opportunity states *why* it matters in strategist language, grounded in the industry and the business's actual detected context (e.g. an HVAC business without a maintenance-plan service gets that suggestion; one that already has one doesn't).
- **Prioritized**: opportunities are always returned highest-priority-first. Priority is expressed through list order, never as a bracket tag embedded in the string — an early implementation of this sprint did embed `"[High priority] ..."` directly in the text, which was caught before shipping because that same string is rendered as-is on the authenticated dashboard's Website Analysis page (`components/dashboard/website-analysis-page.tsx`) and gets unioned across multiple sources in `normalize.ts`, both of which would have leaked literal bracket text to real users. The First Impression UI now shows a "Top priority" badge on the first card purely from its position in the array, with no string parsing required anywhere.
- **Never generic**: every template is gated by `appliesWhen` — a business that already has a maintenance plan doesn't get told to add one; a business with GBP connected and reviews on file doesn't get told to do either. 11 industry categories have 2 dedicated templates each; a universal 4-template fallback (GBP, reviews, meta description, city coverage) covers anything unclassified or industry-agnostic.

---

## Part 6: Confidence scoring review

The scoring formula itself (Known = 90, Assumed = 55, Missing = 0, composite = weighted average) was left unchanged — the codebase's own header comment states this is deliberately simple and fully deterministic, and changing the underlying formula would ripple into the confidence-label thresholds (`confidenceLabels.ts`) and every existing test/UI copy that assumes it, for a benefit (finer-grained scores) that doesn't address the actual problem found.

**The actual problem found**: a field's confidence tier didn't reflect whether there was real evidence behind it. Specifically, `customer-persona.ts`'s own last-resort placeholder (`LOW_CONFIDENCE_CUSTOMER_PERSONA` — its name literally says "low confidence") was still being scored as a full 55/100 Assumed insight, identical to a genuine AI inference. **Fixed** in `buildResult.ts`: when a target-customer value is exactly that sentinel, it now resolves to Missing (value `null`, "We don't yet know who your target customers are yet") instead of Assumed. This is a narrow, specifically-scoped fix — it does not touch any other field, and a real (non-placeholder) persona value still resolves to Assumed exactly as before (both cases have regression tests).

This is the correct instance of "confidence reflects evidence quality": not a broader numeric formula change, but closing the one specific case where the pipeline was silently dressing up "we have nothing" as "we have a guess."

---

## Part 7: First Impression UX review

Reviewed `components/snapshot/*.tsx` for confusing wording, duplicate information, hesitation points, technical language, and long paragraphs. Findings:

- **Fixed — nonsensical action on a Missing insight.** `InsightReviewItem` showed all four decision buttons (Confirm/Correct/Reject/Review Later) on every insight except that Confirm was already correctly hidden for Missing-tier insights. Reject ("That's not right") was still shown for Missing insights — but rejecting a claim we already explicitly said we don't know ("I couldn't determine this yet") doesn't make sense; there is no claim to reject. Fixed: Reject is now hidden alongside Confirm for Missing insights, leaving only "Let me correct it" (tell us the real answer) and "Review later."
- **Fixed — a near-miss on this sprint's own growth-opportunity work** (see Part 5): an intermediate design embedded a visible `[High priority]` bracket tag directly in customer-facing opportunity text. Caught and corrected before shipping.
- **Observed, not changed — an intentional but slightly redundant overlap.** The 3 "top discoveries" (business summary, primary services, target customers) are shown as a read-only glance early in the page, and — if their confidence tier is Assumed or Missing — the *same* insight reappears in the "Worth a quick double-check" guided review section below, this time with full Confirm/Correct/Reject/Review Later controls. This is functionally necessary (removing it would remove the ability to correct these fields at all) and matches the sprint's own original UX spec ordering (glance → question → guided review), but it can read as "didn't I just see this?" repetition. Recommending a future, purely cosmetic pass (e.g., a small "you'll get to review this below" note on the top-discovery cards) rather than changing behavior now — flagged here as a known finding, not silently left unexamined.
- **No changes needed**: paragraph lengths throughout (`scan-form.tsx`, `scan-progress.tsx`, `snapshot-results.tsx`) are already 1–3 sentences, no walls of text; no raw confidence tier names, percentages, or internal field/source identifiers appear anywhere in customer-facing copy; the scan-progress stage labels remain honest (no fake percentages, no claim of private-source access).

---

## Strengths

- The separation between "what the AI produced" (website-analysis, ai-marketing-profile) and "how it's presented with confidence/explainability" (business-discovery) is architecturally sound and made every fix in this sprint safe to make in one layer without touching the other.
- The confirmation contract (Confirm/Correct/Reject/Review Later, PR #75) already had strong structural guarantees against silent Assumed→Known promotion — nothing in this sprint needed to touch that.
- The public Snapshot's SSRF/DNS-pinning hardening (PR #74/#75) is unrelated to intelligence quality but remains a real strength of the foundation this sprint builds on.
- Existing reason-template discipline (Known/Assumed/Missing 3-branch text per field) was a good foundation to extend rather than replace.

## Weaknesses (going into Alpha)

- The heuristic (no-API-key) fallback path is what most of this sprint's fixes targeted, precisely because it's the path that actually runs without a configured `OPENAI_API_KEY` — worth confirming with the team whether Internal Alpha testers will have a real key configured, since the LLM path's prompt-based guardrails (already reasonably good, per the original research) were left unchanged this sprint.
- Growth opportunities are still capped at 2 dedicated templates per industry category before falling back to the 4 generic ones — enough to avoid the old boilerplate, not enough for deep variety within a single category over repeated scans.
- The 7 non-`primaryServices` confirmation fields remain 24-hour-TTL, not durable (a known, previously-documented PR #75 limitation, unchanged by this sprint).

## False assumptions found and corrected

- That a first-match-wins keyword list was an acceptable proxy for "most relevant" — it isn't; frequency-scoring found a real misclassification (insurance agencies as benefits consultants) that a first-match design was structurally blind to.
- That a named "low confidence" placeholder string was safe to score as a normal Assumed insight — it wasn't; the name was a signal the original implementation never acted on.
- That generic-sounding fallback text was low-risk because it was clearly "just a fallback" — the `extractHeadings` bug shows a fallback path can also contain outright bugs (visible markup), not just uninspired copy.

## Missing information

- No eval fixtures exist yet for businesses with materially incomplete or hostile input (e.g. a parked domain, a single-page site with no services listed, a non-English page) — the "unclassified industry" and "no topics detected" cases are covered, but not adversarial/edge content.
- No fixture exercises the LLM (OpenAI) extraction path directly — all 12 eval fixtures run the deterministic placeholder path, since that's what's testable without an API key/cost, per this sprint's "no live websites or paid APIs" constraint. The LLM path's own prompt guardrails were reviewed (Part 1's original research) but not eval-tested end-to-end this sprint.

## Industries that perform well

HVAC, Roofing, Dental, Restaurant, and Coaching (including the AJN Sports Coach profile) all classify with high confidence and produce clearly differentiated, specific personas and growth opportunities — these categories have dense, specific keyword vocabularies that the taxonomy captures well.

## Industries needing improvement

- **Consulting vs. Marketing Agency vs. general "professional services"** have real vocabulary overlap (both mention "strategy," "clients," "engagements") — the eval dataset's current fixtures are unambiguous, but a business blending both (e.g. a marketing consultancy) may classify ambiguously. Worth adding a blended fixture in a future pass.
- **Insurance** required the eval-caught fix in Part 1 — worth continued scrutiny given how much its persona depends on distinguishing "sells insurance" from "consults on employee benefits," a distinction with real vocabulary overlap.
- **SaaS and Ecommerce** industry keyword lists are UI-pattern-based ("add to cart," "free trial") rather than industry-vocabulary-based — this works for a real product page but is more brittle against, e.g., a SaaS company's marketing/about page that never mentions pricing UI language at all.

## Recommended future enhancements

1. Add adversarial/edge-case eval fixtures (parked domains, near-empty sites, non-English content) to `eval/business-discovery/fixtures.ts`.
2. Extend the eval framework to optionally exercise the real OpenAI extraction path (gated behind an explicit opt-in env var, never run by default) so prompt-guardrail regressions are caught the same way heuristic-path regressions now are.
3. Add a "Consulting vs. Marketing Agency" and other adjacent-category blended fixture to stress-test classification boundaries.
4. Revisit the "top discoveries reappear in guided review" UX overlap noted in Part 7 with a small, purely cosmetic pass once there's UI bandwidth.
5. Promote the 7 ephemeral (24h-TTL) confirmation fields to durable storage once cross-session persistence is actually needed (unchanged recommendation from PR #75/PR #76).

---

## Tests performed

- **Unit** (all via `npm run test:unit`, no network/API cost): 7 new/updated test files — `business-discovery-industry-taxonomy.test.ts`, `business-discovery-growth-opportunity-engine.test.ts`, `website-analysis-customer-persona.test.ts`, `website-analysis-content-opportunities.test.ts`, `website-analysis-extractor.test.ts`, `business-discovery-eval-regression.test.ts` (13 tests across all 12 categories), and additions to `business-discovery-build-result.test.ts` (persona-sentinel honesty fix, evidence-phrase enrichment). **1332/1333 passing** — the one failure (`publishing-provider-client.test.ts`, missing `TOKEN_ENCRYPTION_KEY` env var) is a pre-existing environment-configuration issue in a file this sprint never touched.
- **Playwright**: full `tests/first-impression.spec.ts` (22 tests), `tests/business-discovery-continuation.spec.ts` (12 tests), and `tests/business-discovery-public-snapshot.spec.ts` (13 tests) — all passing, confirming the Reject-button and growth-opportunity-card changes didn't regress the existing First Impression experience.
- **Lint**: clean of new issues.
- **Build**: `npm run build` succeeds.

## Product Decision Filter — verified

| Question | Answer |
|---|---|
| Makes the product simpler? | Yes for the customer (specific, industry-aware copy is easier to read and trust than generic boilerplate) and neutral for the codebase (no new customer-facing surface — same screens, same contract, better content). |
| Helps businesses grow? | Yes — growth opportunities are now actionable and specific rather than generic tips no owner would act on. |
| Improves intelligence? | Yes — industry detection went from nonexistent to a real (if simple) classifier; persona detection's core scoring bug is fixed; a real markup-leak bug is fixed; explainability is measurably richer. |
| Increases customer trust? | Yes — the persona-sentinel honesty fix means a business now genuinely sees "I don't know yet" instead of a fake confident guess; no priority-tag bracket text ever reaches a customer. |
| Preserves the illusion of simplicity? | Yes — every change is either invisible backend intelligence work or a small, targeted copy/interaction fix; nothing about the customer's journey through First Impression changed structurally. |
