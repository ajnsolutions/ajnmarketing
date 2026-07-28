# Business Discovery — Public (Pre-Auth) Snapshot Foundation

**Status:** Backend contract + orchestration only — no landing page, no results UI, no signup/account conversion flow
**Branch:** `project-magic/2-0-wave1-public-snapshot-foundation` (based on the not-yet-merged `project-magic/2-0-wave1-business-discovery`, PR #73)
**Part of:** [Project Magic 2.0, Wave I](./project-magic/IMPLEMENTATION_ROADMAP.md#wave-i--free-marketing-snapshot--business-brain-foundation)
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched
**Companion:** [`BUSINESS_DISCOVERY_ENGINE.md`](./BUSINESS_DISCOVERY_ENGINE.md) (the authenticated orchestration this builds on)

---

## What this is

The secure, pre-authentication foundation for the future **Free Marketing Snapshot** ([`project-magic/FREE_MARKETING_SNAPSHOT.md`](./project-magic/FREE_MARKETING_SNAPSHOT.md)). A visitor can submit a website URL (and optionally a business name, city, region, country) and receive a Business Discovery result — without an account, without any private data ever entering the computation.

It is a **new, separate orchestration path** (`lib/business-discovery/public/`), not a boolean flag threaded through the authenticated pipeline from PR #73. The public path imports exactly three of PR #73's pure collector functions and never imports the other three (Google Business Profile, public reviews, Market Context) — that boundary is enforced by what the file imports, by an explicit source allowlist type, and by a runtime filter, not by a runtime `if (isPublic)` check buried in shared code.

## Architecture

```
lib/business-discovery/public/
  types.ts            Versioned contract (request v1, response v1), the
                       PublicDiscoverySourceType allowlist, structured error
                       codes. Pure data — this is the boundary's type-level
                       enforcement.
  validateRequest.ts   Input contract validation: required websiteUrl,
                       optional businessName/city/stateOrRegion/country,
                       field length caps, unsupported-field rejection,
                       contract-version check. Pure.
  urlSafety.ts         SSRF hardening: scheme check, embedded-credential
                       rejection, a real IPv4/IPv6 classifier (loopback,
                       RFC1918, link-local incl. cloud metadata, CGNAT,
                       IPv4-mapped IPv6), and DNS-resolution validation for
                       hostnames (resolver is dependency-injected for tests).
  fetchWebsite.ts      Hardened fetch: manual redirect following (never
                       `redirect: "follow"`) with per-hop SSRF revalidation,
                       a 5-redirect cap, a 2MB streamed response-size cap, and
                       a 10s timeout. Replaces (for this path only) the
                       authenticated lib/website-analysis/fetcher.ts, which
                       has none of these guards and is fine for an
                       authenticated customer fetching their own already-
                       connected website, but not safe pre-auth.
  adapter.ts           The public-safe adapter: builds ephemeral, never-
                       persisted BusinessProfile / WebsiteAnalysis /
                       AiMarketingProfile *shaped* objects from visitor input
                       + the public fetch/extraction, mirroring the existing
                       lib/interactive-demo/stubs.ts pattern.
  mapPublicResult.ts   Maps PR #73's authenticated BusinessDiscoveryResult
                       onto the narrower public contract: drops Customer
                       Perception and Competitive Position (no reviews/Market
                       Context pre-auth), renames fields, and recomputes
                       Overall Confidence from only the 8 fields the public
                       contract actually reports.
  cache.ts             TTL cache (15 min) + a separate, randomly generated
                       conversion-handoff reference (30 min) — see Caching
                       and Conversion handoff below.
  observability.ts     Structured, privacy-conscious event tracking, reusing
                       lib/observability/workflowLogger.ts.
  service.ts           The orchestrator (server-only): validate -> cache
                       check -> fetch -> extract (graceful fallback) -> adapt
                       -> collect (3 allowlisted collectors only, filtered
                       again at runtime) -> normalize -> build (PR #73,
                       unchanged) -> map to public contract -> cache + issue
                       reference.

app/api/business-discovery/snapshot/route.ts
                       The public POST endpoint: rate limiting first (before
                       any body parsing), content-type/size enforcement,
                       JSON validation, structured error responses.
```

### Pipeline

```
Visitor input (websiteUrl, businessName?, city?, stateOrRegion?, country?)
        │
        ▼
Validate request (validateRequest.ts) ──▶ Validate URL / SSRF (urlSafety.ts)
        │
        ▼
Cache check (cache.ts) — hit? return cached public result
        │ miss
        ▼
Hardened fetch (fetchWebsite.ts) — SSRF-safe, size-capped, redirect-revalidated
        │
        ▼
Extraction (existing lib/website-analysis extractor, graceful fallback)
        │
        ▼
Public-safe adapter (adapter.ts) — ephemeral BusinessProfile/WebsiteAnalysis
        │
        ▼
AI Marketing Profile synthesis (existing lib/ai-marketing-profile generator,
graceful fallback) — ephemeral, never persisted
        │
        ▼
Collect (3 allowlisted collectors from PR #73) ──▶ runtime allowlist filter
        │
        ▼
Normalize + buildResult (PR #73, unchanged, pure)
        │
        ▼
Map to public contract (mapPublicResult.ts) + issue snapshotReference
        │
        ▼
Cache the public result; return it
        │
        ▼
(future) Free Marketing Snapshot presentation UI
```

---

## Public vs. authenticated data boundary

| Source | Public snapshot | Authenticated Business Discovery (PR #73) |
|---|---|---|
| Visitor-supplied fields (name, city, region, country) | ✅ Used | — (uses owner-entered `business_profiles` instead) |
| Public website fetch + AI extraction | ✅ Used (hardened fetch) | ✅ Used (existing fetcher, authenticated context) |
| AI Marketing Profile synthesis | ✅ Used (ephemeral, never persisted) | ✅ Used (persisted, tied to the real account) |
| Google Business Profile connection/data | ❌ Never | ✅ Used |
| Public reviews (Google Business reviews table) | ❌ Never | ✅ Used |
| Market Context (competitor signals) | ❌ Never | ✅ Used |
| Any Supabase table read/write | ❌ Never — confirmed by source-level test (no `createClient`, no `.upsert(`, no `.insert(`, no import from a `supabase` module anywhere on this path) | ✅ Used throughout |
| User/tenant/business row creation | ❌ Never | N/A (operates on an existing row) |

**Enforcement, not just intent:** this boundary exists at three layers — (1) the `PublicDiscoverySourceType` type only contains four of the seven `DiscoverySourceType` values, so importing a forbidden collector's result into the public pipeline would need a type assertion to even compile; (2) `service.ts` only imports three of PR #73's six collector functions; (3) after collecting, `service.ts` filters observations through `PUBLIC_DISCOVERY_SOURCE_ALLOWLIST` at runtime, as defense in depth against a future refactor accidentally widening the import list.

---

## Threat model

**In scope / mitigated:**

- **SSRF via a visitor-supplied URL** — scheme allowlist (http/https only), credential rejection, a real IPv4/IPv6 classifier covering loopback, RFC1918 private ranges, link-local (including the 169.254.169.254 cloud metadata address on AWS/GCP/Azure), carrier-grade NAT, and IPv4-mapped IPv6 (`::ffff:127.0.0.1`, a classic blocklist-bypass vector). Node's WHATWG URL parser also auto-canonicalizes decimal/octal/hex-obfuscated IPv4 literals before any of this ever inspects the raw string.
- **SSRF via DNS** — a hostname's resolved addresses are checked against the same blocklist before fetching (dependency-injected resolver for tests).
- **SSRF via redirect** — every redirect hop is manually intercepted and re-validated against the identical policy before being followed; capped at 5 hops.
- **Resource exhaustion via a huge response** — response body is read as a stream and aborted the instant it exceeds 2MB.
- **Resource exhaustion via a huge/slow request** — 8KB request body cap enforced via `Content-Length` and an actual byte-length check; 10s fetch timeout; 20s AI-step timeouts.
- **Abuse of paid AI calls** — 5 requests/hour/IP (matching the existing `lib/interactive-demo` precedent exactly, since every snapshot can trigger up to two OpenAI calls), enforced server-side before any body parsing.
- **Information leakage in errors** — a small, closed set of structured error codes (`validation_failed`, `blocked_url`, `rate_limited`, `timeout`, `upstream_unavailable`, `internal_error`) with customer-safe messages; unhandled exceptions are logged server-side only (`console.error`) and never reach the response body.

**Explicit known limitations (honest, not solved by this foundation):**

- ~~**DNS-rebinding mid-request.**~~ **Closed.** The fetch layer now pins the outbound connection to the literal, already-validated IP address returned by `validatePublicSnapshotUrl` (via `node:http`/`node:https`, no new dependency) — nothing in the runtime can silently re-resolve the hostname to a different address between validation and connection. See [`BUSINESS_DISCOVERY_CONTINUATION.md`](./BUSINESS_DISCOVERY_CONTINUATION.md#part-1-dns-pinned-outbound-fetching) for the full model, including what remains a genuine (network-layer, not DNS) limitation.
- **In-memory rate limiter and cache are single-node.** Both reuse the existing `lib/interactive-demo` pattern's documented caveat: fine for a single-instance or warm-serverless deployment, not a distributed limiter/cache. If this needs to scale across many concurrent instances, that's a Phase 2B infrastructure decision (e.g., a shared store) — deliberately not introduced here to avoid adding paid infrastructure without a proven need.
- **No CAPTCHA / bot-fingerprinting beyond IP-based rate limiting.** A sufficiently motivated actor with many IPs isn't fully stopped by this alone. Acceptable for a foundation; worth revisiting if abuse is observed in practice.

---

## Privacy and data retention

**What is temporarily stored, and why:**

| Data | Where | TTL | Why |
|---|---|---|---|
| The public snapshot result (business summary, services, etc.) | In-memory cache, keyed by `sha256(normalized website URL)` | 15 minutes | Avoids repeating an expensive (two-OpenAI-call) discovery for the same URL if the visitor reloads or a second visitor scans the same site shortly after |
| A snapshot reference token | In-memory reference store, mapping an unguessable random token → the cache key above | 30 minutes | The foundation for a future signup handoff (see below) |

**What is never stored:**

- No user, business, tenant, or Marketing Profile row — this path never creates a Supabase record of any kind.
- No visitor IP address is written to the cache or the reference store (it's used only in-memory, for the instant of the rate-limit check).
- No raw fetched HTML/page content persists beyond the cached *result* (the derived summary/services/etc.), which itself expires in 15 minutes.
- No AI prompts or completions are logged (see Observability).

**Why the cache key is URL-only (not URL + visitor hints):** this is an intentional, documented trade-off. Within the 15-minute window, if a second visitor scans the *same* URL with a different `businessName`/`city` hint, they receive the first visitor's cached result. The website itself is the primary signal; the optional hints are enrichment. This exactly matches the existing `lib/interactive-demo/cache.ts` design, reused rather than redesigned.

**How a future signup may associate a scan with a new account (foundation only, not built here):** the visitor holds `snapshotReference` — an unguessable, random 24-byte token, never derived from the URL (so it can't be predicted for a well-known public site and used to "claim" someone else's snapshot), separate from the cache key. A future Phase 2B conversion endpoint can resolve that reference back to the cached result and offer it as the starting point for Guided Onboarding, without ever exposing the underlying cache key or any database identifier to the client. If the reference has expired (or the process restarted, since this is in-memory), the future flow degrades to "let's start fresh" rather than erroring.

**How anonymous results stay isolated from authenticated tenant data:** the public cache and reference store are separate `Map`s in a separate module from any authenticated cache — a coding mistake in one cannot leak into the other. No authenticated code path reads from this cache, and this cache never reads from any authenticated store, connector, or table.

---

## Caching and TTL

- **TTL: 15 minutes** for the snapshot result — long enough to avoid re-running two OpenAI calls for a page reload or a quick re-visit; short enough that a website's real update (new hours, new services) isn't stale for long, and that no meaningfully old data lingers.
- **TTL: 30 minutes** for the conversion-handoff reference — slightly longer than the result TTL so a reference reliably resolves to "expired" as a distinct state from "unknown reference," rather than the two collapsing into the same case at exactly the same instant.
- **Fails safe:** every cache/reference lookup returns `null` rather than throwing on a miss, an expired entry, or an unknown token. A cache outage (if this ever moves to a real store) should degrade to "always compute fresh," never to an error.

---

## Rate limiting and abuse control

Reuses `lib/interactive-demo/rate-limit.ts`'s `checkRateLimit` directly (not a re-implementation) — an in-memory, sliding-window, per-key limiter, with this feature using its own `public-business-discovery:<ip>` key namespace so its quota is entirely separate from the interactive demo's.

- **Limit:** 5 requests/hour/IP — deliberately identical to the existing interactive-demo limit, since this feature has the same cost profile (up to two OpenAI calls per request).
- **Checked first**, before any body parsing — a flood of requests never reaches JSON parsing, validation, or a network call.
- **Structured 429** with a `Retry-After` header and `{ error: { code: "rate_limited", message } }`.

## Observability

Reuses `lib/observability/workflowLogger.ts` (structured, sanitized logging already used across the authenticated product) rather than a parallel convention. Tracked events: `scan_requested`, `validation_rejected`, `rate_limited`, `cache_hit`, `cache_miss`, `discovery_completed`, `discovery_partial`, `discovery_failed`, `timeout`, `blocked_url`. Never logged: page HTML/text content, AI prompts/completions, the visitor's IP address, or any field value from the request/response bodies.

---

## Conversion handoff

**Shipped since this document was written:** the `snapshotReference` token described below is now resolvable and claimable by an authenticated user, and prefills Guided Onboarding — see [`BUSINESS_DISCOVERY_CONTINUATION.md`](./BUSINESS_DISCOVERY_CONTINUATION.md). Implemented in *this* document's original scope: the `snapshotReference` token, issued and resolvable via `cache.ts`, embedded in every public result. What remained out of scope here (the authenticated resolve/claim/confirm endpoints and the onboarding integration) is now built — the explicit per-insight review *UI* remains future work.

Assumed-to-Known conversion is explicitly **not automatic**. Nothing in this path silently upgrades an Assumed insight to Known — that only ever happens later, through an authenticated user's explicit confirmation (a future correction/edit flow), per this milestone's requirement.

---

## Extension points for future sources

- A new connector category (per [`project-magic/CONNECTOR_FRAMEWORK.md`](./project-magic/CONNECTOR_FRAMEWORK.md)) that's genuinely public-safe (e.g., a future public review aggregator) would add one new value to `PublicDiscoverySourceTypes`, one new collector call in `service.ts`, and nothing else needs to change — the same additive-only discipline PR #73 established for the authenticated path.
- Smart Uploads and further connectors remain explicitly out of scope for the public path (per this task's Scope Boundaries) — a visitor has nothing to upload or connect before an account exists.

---

## Existing components reused

`lib/website-analysis/extractor.ts` (extraction + placeholder fallback), `lib/website-analysis/types.ts`, `lib/ai-marketing-profile/generator.ts` + `openai-generator.ts` (synthesis + placeholder fallback), `lib/interactive-demo/rate-limit.ts` (`checkRateLimit`, unmodified), `lib/interactive-demo/stubs.ts`'s ephemeral-object pattern (mirrored, not imported directly, to keep the two anonymous paths' ephemeral IDs distinct), `lib/observability/workflowLogger.ts`, and PR #73's `collectBusinessProfileObservations` / `collectWebsiteAnalysisObservations` / `collectAiMarketingProfileObservations`, `normalizeBusinessDiscoveryObservations`, and `buildBusinessDiscoveryResult` — all unmodified.

## New abstractions created

`PublicDiscoverySourceType` (the four-value allowlist), the versioned `PublicSnapshotRequestV1`/`PublicBusinessDiscoveryResultV1` contracts, `PublicSnapshotErrorCodes`, the hardened `urlSafety.ts`/`fetchWebsite.ts` pair, the public-safe `adapter.ts`, and the confidence-recomputing `mapPublicResult.ts`.

## Failure behavior

Every upstream failure mode (blocked URL, timeout, too many redirects, oversized response, non-2xx status, AI provider failure) maps to a specific, customer-safe structured error — except AI provider failure, which degrades gracefully (falls back to the deterministic placeholder extractor/generator, tracked as `discovery_partial`) rather than failing the whole request, since a lower-fidelity real result serves the "this already understands my business" goal better than an error page.

## Product Decision Filter — verified

| Question | Answer |
|---|---|
| Makes the product simpler? | Yes — a visitor gets real understanding before creating an account, with zero setup. |
| Helps the business grow? | Yes — this is the proof moment the whole Free Marketing Snapshot funnel depends on. |
| AI performs meaningful work? | Yes — it fetches, reads, and synthesizes a real read of the business, not a form. |
| Understandable to a non-technical owner? | Yes — the contract's field names (Business Summary, Likely Target Customers, Visible Strengths, ...) are plain language by design; nothing in this task exposes that to a UI yet, but the shape is built for it. |
| Fits the Growth Engine vision? | Yes — this is the literal foundation of the Free Marketing Snapshot named in [`project-magic/GROWTH_ENGINE.md`](./project-magic/GROWTH_ENGINE.md). |

**How this preserves the illusion of simplicity:** every hardened, defensive piece of this system (SSRF classification, redirect revalidation, size caps, rate limiting, graceful AI fallback) exists so that the *visitor* never sees a technical failure, a security warning, or a confusing error — they either get an honest, understandable snapshot, or a calm, plain-language "we couldn't do that right now" message. All the complexity is absorbed here, on the backend, exactly as Principle Zero requires (see [`project-magic/PRODUCT_PRINCIPLES.md`](./project-magic/PRODUCT_PRINCIPLES.md)).
