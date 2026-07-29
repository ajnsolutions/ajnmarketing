# Business Discovery — Snapshot Continuation (Anonymous → Authenticated Bridge)

**Status:** Backend contract + orchestration + additive onboarding integration — no final review UI
**Branch:** `project-magic/2-0-wave1-snapshot-continuation`
**Depends on:** PR #73 (AI Business Discovery orchestration) and PR #74 (Public Snapshot foundation) — see [`BUSINESS_DISCOVERY_ENGINE.md`](./BUSINESS_DISCOVERY_ENGINE.md), [`BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md`](./BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md)
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

---

## What this is

This phase completes the secure bridge between the anonymous Free Marketing Snapshot (PR #74) and authenticated Guided Onboarding. A visitor can now:

1. Run a public snapshot and receive an opaque `snapshotReference`.
2. Create or sign into an account.
3. Resume onboarding with that reference (`/onboarding?snapshotRef=...`).
4. Have their visitor-supplied answers prefilled, with zero re-asking.
5. (Future UI) Review each AI-discovered insight and explicitly Confirm, Correct, Reject, or defer it — only then does anything become a durable, user-confirmed fact.

It also closes a real security gap in PR #74's fetch path: DNS-rebinding between URL validation and the outbound connection.

---

## Part 1: DNS-pinned outbound fetching

### The gap this closes

PR #74's `validatePublicSnapshotUrl` resolved a hostname's DNS records and rejected any blocked address — but the fetch step then called `fetch(url)` with the *hostname*, not the validated IP. Node's `fetch` (undici) performs its own, independent DNS lookup at connect time. Between validation and connection, nothing stopped a second lookup from returning a different address — including one a validated-at-that-instant domain reconfigures to return moments later (classic TOCTOU DNS rebinding).

### The fix

`urlSafety.ts`'s `validatePublicSnapshotUrl` now returns the **specific resolved address** it validated (`pinnedAddress`), alongside the original `hostname`, `port`, and `protocol`. `fetchWebsite.ts` never calls the global `fetch()` again — it uses a new primitive, `pinnedRequest.ts`, built on Node's `node:http`/`node:https` (no new dependency):

```ts
transport.request({
  hostname: pinnedAddress,       // the socket connects here — an IP literal, so
                                  // Node performs NO DNS lookup at all
  port,
  path,
  headers: { ...headers, Host: hostname },   // original hostname preserved
  servername: protocol === "https:" ? hostname : undefined, // SNI + cert check
})
```

Node's `net`/`tls` modules detect that `hostname` is already an IP literal and skip resolution entirely — there is nothing left in the runtime capable of silently re-resolving to a different address. The `Host` header and, for HTTPS, the TLS `servername` (which Node's default `checkServerIdentity` validates the certificate against) are both set from the **original hostname**, never the IP — so certificate validation and virtual-hosting behavior are unaffected by connecting via a raw address.

**Every redirect hop is independently re-validated and re-pinned** — a redirect target is never assumed safe because the original URL was; `validatePublicSnapshotUrl` runs again on it, in full, and its own resolved address is what the next hop pins to.

**Fail closed:** if `pinnedAddress` is ever empty (should be structurally impossible, since `validatePublicSnapshotUrl` cannot return without one), `fetchPublicSnapshotWebsite` throws `pinning_unavailable` rather than falling back to a hostname-based connection.

### What's preserved unchanged

Redirect cap (5), response-size cap (2MB, now enforced on *decompressed* output — see below), timeout (10s), scheme restrictions (http/https only), credential rejection, metadata-endpoint protection (169.254.169.254 and friends), IPv4-mapped IPv6 handling (`::ffff:127.0.0.1` still resolves to its embedded IPv4 and is classified accordingly).

### A related fix found along the way: decompression-bomb safety

Switching off the global `fetch()` (which transparently decompresses gzip/deflate/br) meant hand-rolling decompression via `node:zlib`. The response-size cap is applied to the **decompressed** stream, not the wire bytes — so a small compressed payload that would expand past 2MB is still rejected, exactly as if it had arrived uncompressed.

### Runtime limitations (honest, documented)

- **Not full IP-pinning against a rebind mid-connection.** Node's `net.connect`/`tls.connect` still resolve nothing once given a literal IP, so there is no *window* for a second DNS lookup after validation — this is the strongest guarantee achievable without a custom low-level socket/TLS stack. What remains theoretically possible (and effectively unexploitable in practice): a network-level attacker who can intercept the TCP connection to the *already-pinned* IP itself — this is a routing/network-layer concern, not a DNS one, and is out of scope for an application-layer fix.
- **No connection pooling/keep-alive reuse** across hops or requests — each redirect hop opens a fresh connection. Acceptable for a low-volume, bounded (≤5 redirects), timeout-capped fetch; a future high-throughput scenario might want pooling, deliberately not added here to keep the change minimal and auditable.
- Verified with real local-socket tests (`unit-tests/business-discovery-public-pinned-request.test.ts`), not just mocks — a local HTTP server confirms the actual TCP connection target and the `Host` header really are independent.

---

## Part 2 & 3: Snapshot resolution, claiming, and ownership

### Resolution (read-only)

`POST /api/business-discovery/continuation/resolve` — authenticated only. Accepts `{ snapshotReference }`. Validates format (`^[a-f0-9]{48}$`, matching exactly what `issuePublicSnapshotReference` ever produces) before touching any store. Returns the same `PublicBusinessDiscoveryResultV1` shape the anonymous scan already produced — no new response contract, no internal cache key, no database identifier, ever. Distinguishes `not_found` (never issued) from `expired` (issued, since elapsed) — both structurally impossible to leak into each other, verified by tests.

### Claiming (ownership-binding, idempotent)

`POST /api/business-discovery/continuation/claim` — binds a reference to the authenticated `userId`, in-memory, keyed by the same cache key resolution already uses (never a new ID scheme). Rules, all enforced and tested:

| Scenario | Result |
|---|---|
| First claim | `claimed` |
| Same user retries | `already_claimed_by_you` (idempotent — same claim time returned) |
| A different user attempts to claim | `claimed_by_another_user` (409 Conflict) |
| Reference expired | `expired` |

**No account, business, or tenant record is created by claiming.** It is exactly one fact in memory: "user X claimed reference Y at time T." Claim TTL is 24 hours — long enough to cover a full onboarding + review session, short enough to stay clearly non-permanent.

---

## Part 4: Confirmation data contract

`lib/business-discovery/continuation/types.ts` defines the typed contract a future review UI submits against.

### Insight keys — stable, never array position

```
businessSummary · primaryServices · likelyTargetCustomers · brandPersonality
visibleStrengths · onlinePresence.website · onlinePresence.googleBusinessProfile
possibleGrowthOpportunities
```

Exactly the 8 fields the public contract's own confidence recompute already treats as "public-relevant" (see PR #74's `mapPublicResult.ts`) — Customer Perception and Competitive Position were never in the public contract, so they're never confirmable either.

### Decisions

`confirm` · `correct` · `reject` · `review_later`

### The tamper-resistance design

A client submits **only** `{ insightKey, decision, correctedValue?, note? }`. It never submits — and the server never trusts — an "original value," "original source," or "original confidence." Every `ConfirmationRecord`'s provenance fields are derived exclusively from the **currently resolved, claimed snapshot** at decision time. A client that includes extra fields hoping they'll be read (e.g. a fabricated `originalValue`) has them silently ignored — verified explicitly in `unit-tests/business-discovery-continuation-apply-confirmations.test.ts`.

### Resulting fact status

| Decision | Resulting status | Becomes a fact? |
|---|---|---|
| Confirm (on a Known/Assumed insight) | `known_fact` | Yes — using the AI's own value |
| Confirm (on a Missing insight) | `unresolved` | No — defensive no-op, nothing to confirm |
| Correct | `known_fact` | Yes — using the user's corrected value |
| Reject | `rejected` | No |
| Review Later | `unresolved` | No |

**No silent Assumed→Known conversion exists anywhere in this codebase.** The only function capable of producing a `known_fact` status (`applyConfirmationDecision`) requires an explicit `ConfirmationDecisionInput` — there is no code path that reads a tier and promotes it without one.

### Persistence decision — no migration

Of the 8 confirmable keys, exactly one — `primaryServices` — has an existing, durable, non-colliding home: `business_profiles.primary_services`. A minimal, additive server function, `updateBusinessProfileFieldsForUserId` (an `UPDATE`, never an `upsert`/`insert` — a no-op if no profile row exists yet), persists it there.

The other 7 fields have no dedicated column. Two options were considered and rejected:

1. **A new `business_discovery_confirmations` table.** Rejected for this task's scope: Part 3 explicitly says "do not create a large new Business Brain schema," and this genuinely isn't required to ship a working, testable feature — see option 3.
2. **Stuffing markers into `voice_notes`**, mirroring the existing `NO_WEBSITE_VOICE_MARKER`/`buildDeferredConnectionsNote` pattern in `lib/onboarding-storage.ts`. Rejected: `voice_notes` is a **customer-editable, customer-visible** field (rendered directly in the Brand Voice page) — cramming five different confirmation markers into it would corrupt what customers actually see and edit there.
3. **What was built:** confirmation *records* for all 8 keys live in the same class of store as the rest of this ephemeral lifecycle (`confirmationStore.ts`, in-memory, 24h TTL, keyed identically to the claim store) — a future review UI can re-render "what did I already decide" without resubmitting. The one field with a durable home writes there immediately. **Recommended Phase 2B2 work:** promote this to a proper, minimal migration once the review UI is real and cross-session durability beyond 24h is actually needed — see Recommended Phase 2B2 below.

---

## Part 5: Onboarding integration

Reviewed the existing flow (`app/onboarding/page.tsx` → `components/onboarding/onboarding-wizard.tsx`) before changing anything. The wizard already: fetches the existing `business_profiles` row client-side on mount and, if found, fully replaces its form state from it (`profileRowToOnboardingData`) — a returning user's real data always wins, unchanged by this work.

**What was added, additively:**

- `page.tsx` now accepts an optional `?snapshotRef=` search param. If present, it resolves and claims the reference **server-side**, before the wizard ever mounts — using the exact same service functions the API routes use.
- A new, optional `snapshotPrefill` prop on `OnboardingWizard`. When provided, it seeds the wizard's *initial* state (before any saved-profile fetch completes) via `mergeOnboardingPrefill` — which **only fills fields that are still blank**. It never overwrites anything, and a saved profile fetched moments later still fully replaces it if one exists.
- Deliberately narrow: only `businessName`, `websiteUrl`, `city`, `state` — the exact fields the wizard already asks about. The richer AI-derived insights (summary, services, personality, strengths, opportunities) are **not** poured into any form field — they remain accessible only through the explicit confirmation contract (Part 4), for a future dedicated review screen. Soft-prefilling a text input with an unconfirmed AI guess risks a user skimming past it as if it were already true — precisely the blur this feature exists to prevent.

**Fallback behavior, all tested:**

| Condition | Behavior |
|---|---|
| No `snapshotRef` | Standard onboarding, byte-for-byte unchanged |
| Invalid/malformed `snapshotRef` | Resolution returns `invalid`; prefill is `null`; onboarding continues normally |
| Expired `snapshotRef` | Resolution returns `expired`; same graceful fallback |
| Reference already claimed by someone else | Claim fails; no prefill applied for this user |
| Unauthenticated visit with any `snapshotRef` | Existing `/login` redirect fires first, completely unaffected |

Nothing about this integration can block or break standard onboarding — every failure mode degrades to exactly the pre-existing behavior.

---

## Part 6: Snapshot lifecycle

```
Generated (anonymous scan, PR #74)
   │  TTL 15 min — lib/business-discovery/public/cache.ts
   ▼
Available for anonymous presentation (same 15-min window)
   │
   ▼
Referenced during signup — snapshotReference issued, TTL 30 min, random,
   never derived from the URL (public/cache.ts)
   │
   ▼
Claimed by authenticated user — claimStore.ts, TTL 24h, idempotent per user,
   conflict for a different user
   │
   ▼
Insights reviewed (future UI) — decisions submitted via /confirm
   │
   ▼
Confirmed/corrected facts:
   - primaryServices → written to business_profiles (durable)
   - everything else → recorded in confirmationStore.ts (24h TTL)
   │
   ▼
Reference expired or invalidated — every lookup fails safe (returns a
   status, never throws); nothing here is permanent
```

| Store | TTL | Keyed by | Reused/cleaned up |
|---|---|---|---|
| Snapshot result cache | 15 min | `sha256(URL)` | Lazy eviction on next lookup past expiry |
| Snapshot reference | 30 min | random 24-byte hex | Same |
| Claim | 24h | cache key | Same; a claim on an expired snapshot is meaningless and treated as `expired` |
| Confirmation decisions | 24h (refreshed on activity) | cache key | Same |

**Reuse rules:** a claim is idempotent per user (retry-safe); a confirmation resubmission for the same insight key overwrites the previous decision (last-write-wins, not an ever-growing history). **Retry/failure recovery:** every lookup across this entire phase returns a discriminated status (`invalid`/`not_found`/`expired`/`claimed_by_another_user`/etc.) rather than throwing for expected outcomes — a caller (route or future UI) never needs to distinguish "a real bug" from "this just expired."

No raw page content is ever stored beyond the already-summarized `PublicBusinessDiscoveryResultV1` (itself 15-min TTL). Retention was never extended for convenience — every TTL here matches or is deliberately, briefly longer than PR #74's existing windows, for the specific reason stated next to it above.

---

## Part 7: Privacy and logging

Reuses `lib/observability/workflowLogger.ts` (same convention as PR #74's `public/observability.ts`). Tracked events: `continuation_requested`, `reference_resolved`, `invalid_reference`, `expired_reference`, `claim_succeeded`, `claim_conflict`, `confirmation_submitted`, `continuation_completed`/`continuation_failed`, `dns_pinning_rejected`.

**Never logged:** snapshot result bodies, page content, AI prompts/completions, auth tokens, or a reference in plaintext. Where correlation across log lines is useful, only `sha256(reference).slice(0, 16)` is logged — a short, one-way, non-reversible hash (`hashReferenceForLogging`), never the reference itself.

---

## Part 8: Shared-store readiness

The claim store, confirmation store, and (from PR #74) the result cache and reference store are all in-memory `Map`s, instance-local. This is fine for the current hosting posture (a small number of warm serverless instances / a single long-running process) and was a deliberate choice per this task's explicit instruction not to add paid shared infrastructure without a proven need.

**Isolation for a future swap:** every store already exposes a narrow, semantic function interface (`claimSnapshotCacheKey`, `getSnapshotClaimOwner`, `recordConfirmationDecisions`, `getConfirmationDecisions`, `getCachedPublicSnapshotByKey`, `resolvePublicSnapshotReferenceDetailed`, ...) rather than exposing the `Map` itself anywhere. Swapping the backing store (e.g., to Redis/Upstash) means reimplementing these functions' internals only — **no caller, route, or type changes required**.

**The specific trigger condition for that migration:** once this runs across **more than one warm serverless instance concurrently in production** (i.e., real traffic volume that Vercel begins routing across multiple lambda instances rather than reusing one warm one) — at that point a claim made on instance A becomes invisible to a confirm request landing on instance B, silently breaking the flow. This is a measurable, observable trigger (via `claim_conflict`/`not_claimed` rates that don't correlate with real user behavior), not a guess — worth adding a dashboard signal for post-launch, not built in this task.

---

## Known limitations

- DNS-rebind protection covers pre-connection validation, not a hypothetical network-layer interception of the already-pinned socket (see Part 1).
- Confirmation records for 7 of 8 insight keys are 24h-TTL, not permanently durable — see the Persistence decision above and Recommended Phase 2B2.
- Instance-local stores throughout — see Part 8.
- No final review UI — this phase ships the contract and backend only, per explicit scope.

---

## Future UI contract

A future review screen needs only:

1. `POST /resolve` with the reference from the URL/session → render each of the 8 insights with `.value`, `.confidenceTier`, `.reason`, `.sources` (already present on every `DiscoveryInsight`).
2. `POST /claim` once, on entering the review flow (idempotent — safe to call again).
3. `POST /confirm` with an array of `{ insightKey, decision, correctedValue?, note? }` — partial submissions are fine; resubmitting a key overwrites cleanly.
4. Read back `getConfirmationsForUser` (exported from `service.ts`) to restore "what did I already decide" on a return visit within the 24h window.

No other backend work is required to build that UI on top of what this phase ships.

---

## Product Decision Filter — verified

| Question | Answer |
|---|---|
| Makes the experience simpler? | Yes — a visitor who already ran a Snapshot never re-types their business name, website, city, or state during signup. |
| Helps the business grow? | Yes — this is the mechanism that makes the Snapshot's proof-of-understanding actually carry into a real account, instead of being a disconnected marketing gimmick. |
| Automates meaningful work? | Yes — the entire resolve/claim/prefill sequence runs server-side, invisibly, before the wizard even renders. |
| Understandable to a non-technical owner? | Yes, by construction — the confirmation contract's decisions (Confirm/Correct/Reject/Review Later) map to plain, unambiguous verbs a future UI can present with zero jargon. |
| Fits the Growth Engine vision? | Yes — this is literally the "Business Brain Creation" step named in [`project-magic/CUSTOMER_JOURNEYS.md`](./project-magic/CUSTOMER_JOURNEYS.md#5-business-brain-creation). |

**How duplicate questions are reduced:** the wizard's own `data` state is seeded from the resolved snapshot before it ever renders a question — a visitor who already gave their business name and website URL during the anonymous scan is never asked for them again, full stop.

**How user trust is protected:** nothing here ever presents an AI guess as a confirmed fact. Every Assumed insight stays visibly Assumed (tier, source, reason all preserved) until an explicit, authenticated decision changes that — and even then, only via a real user action, never a side effect of merely viewing or claiming a snapshot.

**How the illusion of simplicity is preserved:** the DNS-pinning rewrite, the tamper-resistant confirmation contract, the ownership/conflict handling, and the TTL lifecycle bookkeeping are all backend complexity the visitor never sees. What they experience is: they already told us about their business once, and we didn't make them do it again.
