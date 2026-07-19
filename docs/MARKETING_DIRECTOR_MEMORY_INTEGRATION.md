# Marketing Director × Marketing Memory — Phase 4 Integration

**Branch:** `project-magic-marketing-director-memory-integration` (from latest `main`, post–PR #54)
**Depends on:** [`MARKETING_DIRECTOR_ARCHITECTURE.md`](./MARKETING_DIRECTOR_ARCHITECTURE.md), [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md), [`MARKETING_MEMORY_PREFERENCES.md`](./MARKETING_MEMORY_PREFERENCES.md), [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md)

This document records what Phase 4 actually implements: Marketing Director **consumes** Marketing Memory as optional trusted context. Marketing Director remains the only decision-maker.

---

## 1. Scope

| Piece | Role |
|---|---|
| `lib/marketing-memory/evidenceTypes.ts` | `MarketingMemoryEvidencePackage` + summary shapes |
| `lib/marketing-memory/evidencePackage.ts` | Batched tenant-scoped evidence loader |
| `lib/marketing-director/memoryComposition.ts` | Pure, deterministic candidate reorder + seasonal filter + rationale lines |
| `lib/marketing-director/resolveDecision.ts` | Single composer — consults memoryEvidence |
| `lib/head-of-marketing/service.ts` | Loads evidence in parallel with open-count; threads `actionType` on candidates |

**No new recommendation types. No LLM. No ML. No new providers. No Trigger.dev schedules.**

---

## 2. Precedence (exact)

Implemented as ordered compare keys in `orderCandidatesWithMemory` (not opaque weights):

1. Compliance / safety (existing MD waterfall — e.g. GBP connection — always first)
2. Customer prohibitions (`factor_type: prohibit_action`)
3. Explicit customer preferences (`factor_type: recommended_action_type`)
4. Active goals (rationale only — not a candidate scorer)
5. Strong learnings (`strong_pattern`)
6. Developing learnings (`developing_pattern`)
7. Early learnings (`early_signal`)
8. Market Context (seasonal suppression when disabled; signals listed in memoryContext)
9. Existing recommendation package order (stable tie-break)
10. Generic fallback (unchanged MD nothing-urgent branches)

Learnings never override compliance, prohibitions, or preferences.

---

## 3. What participates / what is ignored

**Preferences participate when:** `is_active` and (`active_until` is null or in the future).

**Ignored preferences:** revoked (`is_active = false`), expired temporary (`active_until` ≤ now).

**Learnings participate when:** status ∈ `emerging | active | weakening`, directional (`positive|negative`), sample_size ≥ 2.

**Ignored learnings:** `superseded`, `archived`, `inconclusive`, non-directional, insufficient sample.

**Disabled context factors:** removed from `marketContextSignals`; matching seasonal hints suppressed (e.g. `political_civic`).

---

## 4. Decision package extension

`MarketingDirectorDecision.memoryContext` (internal only):

- preferencesApplied
- learningsConsidered
- contextConsidered
- ignoredLearnings / ignoredPreferences
- precedenceExplanation
- confidenceExplanation

`toMarketingDirectorClientView` does **not** expose this. Customer copy stays calm (“You've told us…”, “We've noticed…”, “Historically…”) — never weights or coefficients.

---

## 5. Cold start / regression

When `memoryEvidence` is null or `isColdStart: true`:

- Candidate order matches the caller’s existing recommendation package order
- Seasonal hint is unchanged (unless disabled categories apply — cold start has none)
- Primary decision type / CTA / summary match pre-Phase-4 behavior for the same signals

---

## 6. Performance

`buildMarketingMemoryEvidencePackage` runs **one** `Promise.all` of:

1. preferences list
2. learnings list
3. latest market context brief + items

Head of Marketing service loads open-count + evidence in parallel, then loads candidates once and fetches explainability for the memory-aware top only.

---

## 7. Explicit non-goals

- Marketing Memory does not create, score, publish, approve, or suppress recommendations as an authority
- No second `resolveMarketingDirectorDecision`
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`
