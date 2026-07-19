# Marketing Memory Preferences — Phase 3 Implementation

**Branch:** `project-magic-marketing-memory-preferences` (from latest `main`, post–PR #53)
**Depends on:** [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md), [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md), [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md) (optional `related_learning_id` / contradicting evidence citation).

This document records what Phase 3 ("customer preferences and overrides") actually implements — not aspirational scope. See §12 for what is deliberately *not* included.

---

## 1. Phase 3 Scope

| Piece | What it is |
|---|---|
| `supabase/migrations/026_marketing_memory_preferences.sql` | `marketing_memory_overrides` + `marketing_memory_preferences`, narrow promotion-link update guard, additive `override` source_type on evidence_links |
| `lib/marketing-memory/preference*.ts` / `override*.ts` | Types, config, validation, idempotency, precedence helpers, persistence, services, request parsers, browser client |
| `app/api/marketing-memory/preferences` / `overrides` | Authenticated, tenant-scoped read/write APIs |
| `app/dashboard/marketing-preferences` + settings hub link | Minimal additive settings surface |

**Preferences and overrides were recorded but not consumed in the Phase 3 PR.** Phase 4 now consults active preferences via `MarketingMemoryEvidencePackage` — see [`MARKETING_DIRECTOR_MEMORY_INTEGRATION.md`](./MARKETING_DIRECTOR_MEMORY_INTEGRATION.md). They still do not score, create, publish, or approve recommendations.

---

## 2. Deviations from the Architecture / Data Model Docs, and Why

1. **`content_tone` is excluded from `preference_type`.** Brand Voice / `business_profiles` voice fields remain the sole authoritative tone surface. Accepting a parallel `content_tone` preference would create competing instructions. Validation also rejects writes that try to smuggle goals/voice into `custom`.

2. **Preference changes soft-supersede instead of rewriting `instruction_text` in place.** When a structured preference identity already has an active row and the instruction (or `active_until`) changes, the old row is set `is_active = false` and a new active row is inserted with `supersedes_preference_id`. Identical re-saves are idempotent. This preserves audit history of prior customer statements.

3. **Multiple active `custom` preferences are allowed.** Each custom row receives a unique `factor_value` (`custom:<uuid>`) so the live partial unique index does not collapse unrelated free-text instructions into one slot.

4. **Overrides are append-only except `promoted_to_preference_id`.** A trigger rejects any other column mutation. This keeps history intact while still allowing the bidirectional promotion link the data model describes.

5. **`decision_link_id` is a nullable uuid without an FK.** `marketing_memory_decision_links` is Phase 4; Phase 3 keeps the column for forward compatibility without inventing the table.

6. **Actor attribution columns (`created_by` / `updated_by`) are required additions.** Every preference/override write sets these from the authenticated session user — never from a background job, never inferred from outcomes.

7. **[Claude review] `marketing_memory_preferences` gained a mutation-guard trigger, mirroring the one overrides already had.** The original migration's UPDATE policy (`with check (auth.uid() = user_id)`) only re-verified row ownership — it did not stop an owner from directly rewriting `created_by`, `business_profile_id`, `preference_type`, `instruction_text`, or the promotion/supersession links via a raw PostgREST call that bypasses `lib/marketing-memory/preferencePersistence.ts` (which only ever updates `is_active`/`active_until`/`updated_by`). `marketing_memory_preferences_mutation_guard()` now makes that the actual, database-enforced contract. Live-verified: `created_by`/`business_profile_id`/`instruction_text` updates are rejected with `P0001`; `is_active`/`updated_by` updates succeed.

8. **[Claude review] `marketing_memory_preferences` gained a self-supersession check constraint** (`supersedes_preference_id <> id`) — cheap DB-level backstop alongside the application-level guarantee that `supersedes_preference_id` is only ever set from a row already resolved via `findActivePreferenceByIdentity` (itself scoped to the same tenant). Live-verified: an insert with `id = supersedes_preference_id` is rejected with `23514`.

9. **[Claude review] `recordOverrideForBusiness` now verifies `relatedLearningId` ownership before insert.** The original code accepted any syntactically valid uuid for `related_learning_id` — since `marketing_memory_learnings` only has an FK, not an ownership check, a client could reference another tenant's learning by id, and a `marked_learning_incorrect` override would then write a learning-anchored `evidence_links` row citing it as contradicting evidence for that other tenant's Learning. `lib/marketing-memory/overridePersistence.ts`'s new `learningBelongsToBusiness` closes this — a `relatedLearningId` that doesn't resolve to a `marketing_memory_learnings` row owned by the same `user_id`/`business_profile_id` is now rejected with 400 before any write happens.

---

## 3. Authoritative Settings Boundary

These remain outside Marketing Memory and are **not** duplicated or overridden here:

| Concern | Authoritative home |
|---|---|
| Marketing goals / Monthly Focus priorities | `business_profiles.marketing_goals` / Monthly Focus |
| Brand voice / tone / preferred words | Brand Voice settings + `business_profiles` voice fields |
| Legal / compliance / safety rails | Existing publishing and content-approval controls |

Phase 3 preference types are limited to: `channel_priority`, `publishing_day_restriction`, `context_category_toggle`, `approval_requirement`, `custom`.

---

## 4. Actor Attribution and Audit History

- **Overrides:** `created_by` required; RLS insert requires `auth.uid() = created_by`. No delete. No general update.
- **Preferences:** `created_by` required on insert; `updated_by` set on soft-deactivate / supersession bookkeeping. No delete policy — “remove” means `is_active = false`.
- **Supersession chain:** `supersedes_preference_id` links the new active row to the deactivated predecessor.
- **Promotion chain:** permanent override → preference via `promoted_from_override_id` + `promoted_to_preference_id` + `source = promoted_override`.

---

## 5. Preference Precedence (read-time vocabulary only)

Implemented in `lib/marketing-memory/preferencePrecedence.ts` as an ordinal matching architecture §16:

1. Legal / compliance (not modeled in these tables)
2. Explicit customer preferences
3. Current business goals (external)
4. Strong learnings
5. Developing / early learnings
6. Generic best practices

Phase 3 uses this only to sort preference summaries and to list disabled context categories for API honesty. **Nothing in Marketing Director reads it yet.**

---

## 6. Override Capture and Promotion

`recordOverrideForBusiness`:

1. Validates closed `override_type` vocabulary.
2. Inserts an append-only override with a server-built idempotency key.
3. If `marked_learning_incorrect`, best-effort upserts a learning-anchored evidence_link with `source_type = override`, `contribution = contradicting`.
4. If `is_permanent`, promotes into a preference (when a structured mapping or notes exist) without requiring a separate manual step.

One-time overrides (`is_permanent = false`) never become preferences.

---

## 7. RLS Summary

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `marketing_memory_overrides` | own `user_id` | own + `created_by = auth.uid()` | own, promotion-link only (trigger-enforced) | none |
| `marketing_memory_preferences` | own `user_id` | own + `created_by = auth.uid()` | own | none |

---

## 8. Customer Surface

- Settings hub link → `/dashboard/marketing-preferences`
- Minimal controls: disable context category, avoid publishing day, custom standing instruction, list/turn off active preferences, read-only recent overrides
- Copy states clearly that recommendations / Weekly Briefing are **not** changed yet

---

## 9. Files Touched Outside `lib/marketing-memory/`

- `app/api/marketing-memory/preferences/route.ts`
- `app/api/marketing-memory/overrides/route.ts`
- `app/dashboard/marketing-preferences/*`
- `components/dashboard/marketing-memory-preferences-page.tsx`
- `components/dashboard/settings-hub.tsx` (one additive link)
- docs listed in the PR
- unit tests + `fake-supabase-client` `.is()` support

Confirmed non-goals: no edits under `lib/marketing-director/`, `lib/marketing-decisions/`, or recommendation scoring paths that would consume preferences.

---

## 10. Testing

Unit coverage includes validation (including Brand Voice boundary), precedence ordering, persistence supersession/idempotency + tenant filters, override→preference promotion, contradicting evidence citation, and request/idempotency helpers.

---

## 11. Self-Review Checklist

This section was rewritten during an independent Claude Code review of the merged PR (not the original author's self-assessment) — every finding below was verified directly against code and, where noted, the live database, and every "Gap found and fixed" row was actually fixed in the same review pass.

| Check | Finding |
|---|---|
| Preferences inferred from outcomes | Not present — only explicit API/settings writes and permanent-override promotion. Confirmed no code path in `lib/marketing-memory/preference*.ts`/`override*.ts` reads `recommendation_outcome_events`, `analytics_snapshots`, or Phase 2 learnings to derive a preference. |
| Competing tone/goals authority | Blocked — `content_tone` rejected explicitly in `preferenceValidation.ts`; custom text rejecting goals/voice language; confirmed no writable reference to `marketing_goals`/`voice_notes`/`brand_voice_tone`/`preferred_words` anywhere in the new code (only read-only pointer comments and validation-error text). |
| Hard deletes / silent expiry | Not present — no delete policy on either table (live-verified: an anon `DELETE` matches zero rows, and no authenticated-role delete policy exists for the owner either); `active_until` only ever set from explicit customer input. |
| **Actor spoofing via direct UPDATE** | **Gap found and fixed.** The original `marketing_memory_preferences` UPDATE policy only checked row ownership, not which columns changed — a client could rewrite `created_by`, `business_profile_id`, `preference_type`, `instruction_text`, or the promotion/supersession links directly via PostgREST, bypassing the service layer that only ever touches `is_active`/`active_until`/`updated_by`. Fixed with `marketing_memory_preferences_mutation_guard()` (deviation §2.7), mirroring the guard `marketing_memory_overrides` already had. Live-verified. |
| **Cross-tenant `related_learning_id`** | **Gap found and fixed.** `related_learning_id` was accepted as any syntactically valid uuid with no ownership check — a `marked_learning_incorrect` override could reference (and write contradicting evidence against) another tenant's Learning. Fixed with `learningBelongsToBusiness` ownership verification before insert (deviation §2.9). |
| **Self-supersession** | **Gap found and fixed.** No constraint prevented `supersedes_preference_id = id`. Not reachable through the current service layer (which only ever sets it from a separately-resolved existing row), but added as a cheap DB-level backstop (deviation §2.8). Live-verified. |
| **Promotion-link failure observability** | **Gap found and fixed.** If `linkOverrideToPreference`'s UPDATE failed for any reason, the created preference and the override's still-null `promoted_to_preference_id` were both handled correctly (the response never lied about the link state — see below), but the failure was completely silent: no log line anywhere. Added structured `[MarketingMemoryOverrides]` logging for both the success (`override_promoted`) and failure (`override_promotion_link_failed`) paths. |
| Promotion partial-failure honesty | Confirmed **not** a defect on inspection, despite the observability gap above: when the forward link fails, the response still returns the original override object (`promoted_to_preference_id: null`, accurate) alongside the successfully created `preference` (which independently carries `promoted_from_override_id`, the authoritative backward link) — the API response never claims a link that doesn't exist. A retry is safe: `upsertPreferenceWithSupersession`'s identical-content check (§6) finds the already-created preference and returns it rather than duplicating, so a retried promotion cannot create two preferences for the same override. |
| Wired into Marketing Director | Not present — grepped for every consumer of `preferenceService`/`overrideService`/`preferencePersistence`/`overridePersistence`/`preferencePrecedence`/the two table names across the repo; the only matches outside `lib/marketing-memory/`, tests, docs, and migrations are the two new API routes and the one new UI page. Zero files under `lib/marketing-director/`, `lib/marketing-decisions/`, `lib/recommendation-learning/`, `lib/head-of-marketing/`, or `trigger/` were touched (confirmed via `git diff --stat`). |
| Override history editable | Blocked by promotion-only update trigger — live-verified: a `notes` update is rejected (`P0001`); the promotion-link update succeeds exactly once and is then immutable. |
| `businessProfileId` ownership defense-in-depth | Not a live vulnerability — both API routes resolve `businessProfileId` exclusively via `getBusinessProfileForUser()`, which independently re-derives the authenticated user from cookies server-side and is never influenced by client-supplied JSON. Flagged as a lower-priority hardening note (§13) rather than fixed: the service-layer functions (`upsertPreferenceForBusiness` etc.) trust their caller's `businessProfileId` rather than re-verifying it themselves, which is fine for the two callers that exist today but is worth tightening before any future caller is added. |
| Observation/audit event integration (Section 13 of the review brief) | **Not implemented — documented as a known limitation (§12), not fixed in this pass.** The review brief expected factual `preference_created`/`override_promoted`/`factor_disabled`-style events in Phase 1's observation ledger. No such wiring exists. Deliberately not added during this review: doing it well requires touching Phase 1's `lib/marketing-memory/service.ts`/`persistence.ts` and extending `marketing_memory_observations.observation_type`'s check constraint in migration 024 — which this review's instructions explicitly forbid modifying. Recommended as an explicit, separate follow-up rather than a rushed addition. |

---

## 12. Known Limitations / Next Phase

- Override-capture is API-ready; Weekly Briefing / recommendation UIs do not call it yet.
- `decision_link_id` cannot FK until Phase 4.
- Disabled context categories are listed by API but not applied to market-context ranking yet.
- **No Phase 1 observation/audit events are recorded for preference or override writes** (`preference_created`, `override_promoted`, `factor_disabled`, etc. do not exist yet) — found during Claude Code review and intentionally left as a follow-up rather than fixed in that pass, since it requires extending migration 024's `observation_type` check constraint, which is out of scope for a fix applied on top of migration 026. See §11.
- **Preference/override writes are not transactional across their multi-step sequences** (find-existing → deactivate → insert for supersession; insert override → insert preference → link promotion). Each step is idempotent-safe on retry (partial unique indexes and identical-content checks prevent duplicates), and the one identified failure mode (a promotion's forward link not persisting) is now logged (§11) — but a true multi-statement transaction (e.g. via a Postgres function) was not added in this review, matching the same sequential-with-documented-limitation pattern already used by Phase 2's learning reconciliation.
- `businessProfileId` is trusted by the service layer rather than independently re-verified against the caller's `userId` — safe today because both existing API routes derive it server-side, but worth tightening (a cheap ownership check in the service functions themselves) before a third caller is added.
- **Phase 4 — Marketing Director consumption is implemented** — see [`MARKETING_DIRECTOR_MEMORY_INTEGRATION.md`](./MARKETING_DIRECTOR_MEMORY_INTEGRATION.md). Preferences remain optional evidence only; Marketing Director is still the sole decision-maker. Persisting `marketing_memory_decision_links` remains a later additive audit step.
