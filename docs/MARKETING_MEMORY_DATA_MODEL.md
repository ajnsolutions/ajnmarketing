# Marketing Memory — Data Model

**Type:** §1–§2 and §4 (Observations, Context Snapshots, Evidence Links) are **implemented** — see `supabase/migrations/024_marketing_memory_foundation.sql` and [`MARKETING_MEMORY_FOUNDATION.md`](./MARKETING_MEMORY_FOUNDATION.md) for the as-built design, including documented deviations from this document's original proposal. §3 and §5–§7 (Learnings, Preferences, Overrides, Decision Links) remain **proposed, future-phase design only** — no migration exists for them yet.

Companion documents: [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) (read first — this document assumes its layer definitions, precedence order, and confidence model) and [`MARKETING_MEMORY_FOUNDATION.md`](./MARKETING_MEMORY_FOUNDATION.md) (the Phase 1 implementation record — the authoritative source for what §1/§2/§4 actually look like in production; this document has been updated to match it, but the migration file is the ultimate source of truth).

---

## 0. Conventions carried over from the existing schema

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `business_profile_id uuid not null references business_profiles(id) on delete cascade`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` + a `set_<table>_updated_at()` trigger, for every **mutable** table (append-only tables omit this, matching `recommendation_outcome_events`' precedent)
- RLS enabled on every table, with `auth.uid() = user_id` policies. Append-only tables get `select`/`insert` policies only — no `update`/`delete` — matching `recommendation_outcome_events`.
- Idempotency via either a composite unique index (matching `marketing_opportunities`/`marketing_recommendations`) or a single `idempotency_key text unique` column (matching `recommendation_outcome_events`), chosen per-entity below based on which pattern fits its write pattern.

---

## 1. `marketing_memory_observations` — IMPLEMENTED

**Phase:** 1 (first release, shipped in `024_marketing_memory_foundation.sql`)
**Layer:** Observations
**Lifecycle:** Append-only. Never updated or deleted except by cascade.

### Responsibility

One row per factual, attributable event. Never a conclusion — a Learning is derived *from* many Observations, never stored here.

### As-built columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | tenant owner |
| `business_profile_id` | `uuid not null` | tenant scope |
| `observation_type` | `text not null` | ten-value closed vocabulary — `recommendation_drafted \| recommendation_edited \| recommendation_approved \| recommendation_rejected \| recommendation_do_more_like_this \| publishing_queued \| publishing_succeeded \| publishing_failed \| performance_measured \| analytics_snapshot_captured` |
| `source_system` | `text not null` | `recommendation-outcomes \| analytics` — diagnostic/filtering only |
| `source_outcome_event_id` | `uuid null references recommendation_outcome_events(id) on delete set null` | reference, not copy |
| `source_analytics_snapshot_id` | `uuid null references analytics_snapshots(id) on delete set null` | reference, not copy |
| `context_snapshot_id` | `uuid null references marketing_memory_context_snapshots(id) on delete set null` | which context was active (§2) |
| `occurred_at` | `timestamptz not null` | when the underlying real-world event happened (not `created_at`, which is when we recorded it) |
| `outcome_direction` | `text not null default 'unknown'` | `positive \| negative \| neutral \| mixed \| unknown` — assigned by a fixed, non-inferential rule table, see `MARKETING_MEMORY_FOUNDATION.md` §6 |
| `location_scope` | `text null` | reserved for a future multi-location business; always null today |
| `metric_summary` | `jsonb not null default '{}'` | small, bounded, sanitized facts only — never a copy of a full analytics row or raw provider payload (see `MARKETING_MEMORY_FOUNDATION.md` §9) |
| `schema_version` | `smallint not null default 1` | |
| `retention_classification` | `text not null` | `short_lived_context \| standard_operational_evidence \| long_term_audit_evidence` |
| `idempotency_key` | `text not null unique` | `obs:{business_profile_id}:{source_type}:{source_id}` |
| `created_at` | `timestamptz not null default now()` | |

**Deviation from the original proposal**: `source_recommendation_id` and `source_content_approval_id` were **not** added as direct columns. Exactly one of `source_outcome_event_id`/`source_analytics_snapshot_id` is required (database `check` constraint `marketing_memory_observations_exactly_one_primary_source`); every other related record is captured via `marketing_memory_evidence_links` instead (§4). See `MARKETING_MEMORY_FOUNDATION.md` §2 for the full rationale.

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, occurred_at desc)` — the primary read path (Phase 2's Learning derivation scans recent observations per business)
- `index (observation_type)`
- partial `index (source_outcome_event_id) where source_outcome_event_id is not null`
- partial `index (source_analytics_snapshot_id) where source_analytics_snapshot_id is not null`
- partial `index (context_snapshot_id) where context_snapshot_id is not null`

### RLS

`select`, `insert` only for `auth.uid() = user_id`. No `update`/`delete` policy — matches `recommendation_outcome_events`' append-only precedent exactly, for the same reason: a fact, once recorded, is never edited, only superseded by a new fact. Live-verified (see `MARKETING_MEMORY_FOUNDATION.md` §12).

### Example record (as inserted by `lib/marketing-memory/service.ts`)

```json
{
  "observation_type": "recommendation_approved",
  "source_system": "recommendation-outcomes",
  "source_outcome_event_id": "a1b2...",
  "source_analytics_snapshot_id": null,
  "context_snapshot_id": "f00d...",
  "occurred_at": "2026-06-11T09:00:00Z",
  "outcome_direction": "positive",
  "metric_summary": {},
  "retention_classification": "long_term_audit_evidence",
  "idempotency_key": "obs:9e21...:recommendation_outcome_event:a1b2..."
}
```

---

## 2. `marketing_memory_context_snapshots` — IMPLEMENTED

**Phase:** 1 (first release, shipped in `024_marketing_memory_foundation.sql`)
**Layer:** Observations (the "what conditions surrounded it" half)
**Lifecycle:** Append-only. One row is reused per business per UTC calendar day (idempotent get-or-create), not one row per observation.

### Responsibility

Captures which `market_context_items` were active near the moment an Observation was recorded — without copying their full content. This is the normalization boundary described in the architecture doc's §14, materialized as a table.

### As-built columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `captured_at` | `timestamptz not null` | the real-world moment this snapshot describes conditions for |
| `context_item_ids` | `uuid[] not null default '{}'` | references into existing `market_context_items` — **not copied**; bounded to 5 items, ±3-day window, ordered by `relevance_score` |
| `context_summary` | `jsonb not null default '{}'` | small, deterministic calendar facts only — `dayOfWeek`, `month`, `season`, `contextItemCount` |
| `impact_direction` | `text not null default 'unknown'` | `positive \| negative \| neutral \| unknown` — always `unknown` in Phase 1 (classification is Learning-layer work) |
| `observed_vs_forecast` | `text not null default 'observed'` | `observed \| forecast` |
| `retention_classification` | `text not null default 'short_lived_context'` | always `short_lived_context` in Phase 1 |
| `valid_from` | `timestamptz not null` | |
| `valid_until` | `timestamptz null` | |
| `expires_at` | `timestamptz not null` | hard retention boundary, default `captured_at + 180 days` |
| `idempotency_key` | `text not null unique` | `ctx:{business_profile_id}:{utc-date}` — one snapshot per business per day |
| `created_at` | `timestamptz not null default now()` | |

**Deviation from the original proposal**: added `retention_classification`, `valid_from`, `valid_until`, and a required (not optional) `expires_at` — the original proposal's idempotency key was per-observation (`ctx:{business_profile_id}:{captured_at_iso}`); the as-built key is per-business-per-day, since reusing one snapshot across a day's observations is both cheaper and avoids near-duplicate rows. See `MARKETING_MEMORY_FOUNDATION.md` §4 and §8.

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, captured_at desc)`
- `gin index (context_item_ids)` — matches the existing GIN-index precedent on `marketing_recommendations.related_opportunity_ids`
- `index (expires_at)` — backs the Phase 1 retention diagnostic query

### RLS

`select`, `insert` only — append-only, same rationale as §1. Live-verified.

---

## 3. `marketing_memory_learnings` — PROPOSED (not yet implemented)

**Phase:** 2
**Layer:** Learnings
**Lifecycle:** Mutable only for status transitions (`active → historical/expired/superseded`); the substantive claim fields (`summary`, `sample_size`, etc.) are set once at creation and only ever replaced by creating a **new** row that supersedes the old one — never edited in place. This preserves the "superseded, not deleted" decay rule from the architecture doc §12.

### Responsibility

A named, confidence-scored, evidence-linked pattern claim.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `learning_type` | `text not null` | `timing \| weather \| calendar \| community \| sports_entertainment \| political_civic \| market_conditions \| channel_performance \| category_performance` — fixed vocabulary, `check` constrained, mirrors the architecture doc's Context Factors categories plus the existing recommendation-learning bucket dimensions |
| `summary` | `text not null` | plain-language, template-generated per architecture §11 — never free-form causal text |
| `confidence_level` | `text not null` | `early_signal \| developing_pattern \| strong_pattern \| confirmed_preference` — `check` constrained to exactly these four values |
| `sample_size` | `integer not null` | count of supporting observations; `check (sample_size >= 2)` enforces the architecture doc's minimum-evidence floor |
| `consistency` | `numeric(4,3) null` | 0–1, fraction of supporting observations that agree |
| `date_range_start` | `date not null` | |
| `date_range_end` | `date not null` | |
| `comparison_baseline` | `text not null` | human-readable description, e.g. "trailing 8-week average for this business" — never a cross-tenant benchmark (see architecture §9) |
| `recurrence_pattern` | `text not null default 'none'` | `none \| annual_month \| annual_range \| recurring_weekly` |
| `recurrence_value` | `text null` | e.g. `"december"`, `"nov_15..jan_05"`, `"thursday"` |
| `status` | `text not null default 'active'` | `active \| historical \| expired \| superseded` |
| `superseded_by_learning_id` | `uuid null references marketing_memory_learnings(id) on delete set null` | set only when `status = 'superseded'` |
| `active_until` | `timestamptz null` | null = no fixed expiry (governed by `recurrence_pattern` instead); non-null for one-time/expired-context learnings |
| `dedupe_key` | `text not null` | e.g. `{business_profile_id}:{learning_type}:{recurrence_value}` — see uniqueness below |
| `created_at` / `updated_at` | `timestamptz` | standard, `updated_at` trigger for `status`/`superseded_by_learning_id` transitions only |

### Indexes / uniqueness

- `unique index on (business_profile_id, dedupe_key) where status = 'active'` — **partial unique index**, matching the existing `content_approvals_active_recommendation_idx` "at most one active X per Y" precedent (`019_recommendation_content_link.sql`). This guarantees at most one *active* Learning per business per pattern, while still allowing historical/superseded rows to accumulate without a uniqueness conflict.
- `index (business_profile_id, status)`
- `index (learning_type)`

### RLS

Standard `select/insert/update` for `auth.uid() = user_id`. **No `delete` policy** — Learnings are never deleted, only superseded, enforcing the audit-history rule at the database layer, not just by convention.

### Example record

```json
{
  "learning_type": "timing",
  "summary": "Posts published on Thursday mornings have historically performed better for this business.",
  "confidence_level": "strong_pattern",
  "sample_size": 9,
  "consistency": 0.78,
  "date_range_start": "2026-03-01",
  "date_range_end": "2026-06-30",
  "comparison_baseline": "trailing 8-week average for this business",
  "recurrence_pattern": "recurring_weekly",
  "recurrence_value": "thursday",
  "status": "active",
  "dedupe_key": "9e21...:timing:thursday"
}
```

---

## 4. `marketing_memory_evidence_links` — IMPLEMENTED (redesigned for Phase 1)

**Phase:** 1 (first release, shipped in `024_marketing_memory_foundation.sql`) — **elevated from the original Phase 2 proposal**; see the deviation note below.
**Layer:** Evidence attribution (Observations → their source records)
**Lifecycle:** Append-only.

### Responsibility

Polymorphic join between an **observation** and every source record it references — the concrete mechanism behind "where did this evidence come from."

### Deviation from the original proposal

The original data-model document scoped this table to Phase 2, anchored on `learning_id` (a Learning citing its supporting/contradicting evidence). Since no Learnings exist yet, this implementation anchors the table on **`observation_id`** instead — every observation's related source records (the recommendation, a content approval, a publishing job) beyond its one direct typed FK (§1) are recorded here. The `contribution` field (`supporting | contradicting | neutral`) is **not implemented** in Phase 1 either — that's a Learning-layer judgment about whether a piece of evidence helps or hurts a claim, which doesn't apply to a plain observation citing its own source records. It is replaced by `link_type` (`primary_source | related_source`), a purely structural distinction. A future Phase 2 migration can add a nullable `learning_id` column and a `contribution` column without renaming or breaking this table. See `MARKETING_MEMORY_FOUNDATION.md` §2 and §5 for the full rationale.

### As-built columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `observation_id` | `uuid not null references marketing_memory_observations(id) on delete cascade` | |
| `source_type` | `text not null` | `recommendation \| recommendation_outcome_event \| content_approval \| publishing_job \| analytics_snapshot \| market_context_item (reserved) \| monthly_focus (reserved)` — `check` constrained |
| `source_id` | `uuid not null` | polymorphic id — no FK constraint possible across six source tables; validity enforced at the application layer (`lib/marketing-memory/types.ts`'s `MarketingMemorySourceEntityTypes`), matching how `market_context_items.metadata` already stores loosely-typed provenance without a hard FK |
| `link_type` | `text not null default 'related_source'` | `primary_source \| related_source` |
| `idempotency_key` | `text not null unique` | `{observation_id}:{source_type}:{source_id}` |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (observation_id)`
- `index (source_type, source_id)`

### RLS

`select`, `insert` only — append-only. Live-verified, including the `source_type` check constraint rejecting an unsupported value.

### What Phase 1 actually populates

- Outcome-event-derived observations: `recommendation_outcome_event` (`primary_source`), `recommendation` (`related_source`, always), `content_approval` (`related_source`, when present), `publishing_job` (`related_source`, when present).
- Analytics-snapshot-derived observations: `analytics_snapshot` (`primary_source`) only.
- `market_context_item` links are **not** populated here in Phase 1 — that relationship is already fully captured by `context_snapshots.context_item_ids` (§2); duplicating it as individual rows here would be the exact "duplicate storage" pattern the architecture self-review warns against.

---

## 5. `marketing_memory_preferences` — PROPOSED (not yet implemented)

**Phase:** 3
**Layer:** Customer Preferences
**Lifecycle:** Mutable (a preference can be edited/disabled/re-enabled by the customer directly — this is the one entity in the model where in-place edits are appropriate, since a preference is a live instruction, not a historical fact).

### Responsibility

Explicit, customer-stated instructions. Never inferred, never written by a background job — every row's `created_by` is a real customer action.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `preference_type` | `text not null` | `channel_priority \| publishing_day_restriction \| context_category_toggle \| content_tone \| approval_requirement \| custom` — fixed vocabulary |
| `factor_type` | `text null` | when `preference_type = 'context_category_toggle'`, which category — e.g. `political_civic`, `sports_entertainment`, `competitor` |
| `factor_value` | `text null` | free-form value paired with `factor_type`, e.g. a specific day name for `publishing_day_restriction` |
| `instruction_text` | `text not null` | plain-language, e.g. "Avoid publishing on Sundays" — the canonical, customer-visible statement of the preference |
| `is_active` | `boolean not null default true` | disabling sets this false; never deleted (audit trail) |
| `source` | `text not null default 'explicit_statement'` | `explicit_statement \| promoted_override` — distinguishes a preference stated directly (e.g. in settings) from one promoted from a permanent override (§6) |
| `promoted_from_override_id` | `uuid null references marketing_memory_overrides(id) on delete set null` | set when `source = 'promoted_override'` |
| `created_at` / `updated_at` | `timestamptz` | standard, with `updated_at` trigger |

### Indexes / uniqueness

- `unique index on (business_profile_id, preference_type, factor_type) where is_active = true` — partial unique index, same "at most one active X" pattern as §3, preventing duplicate active preferences of the same kind (a customer can still have one *inactive* history and one *active* current statement for the same `factor_type`).
- `index (business_profile_id, is_active)`

### RLS

Standard `select/insert/update` for `auth.uid() = user_id`. `delete` intentionally **not** granted — a customer "removes" a preference by setting `is_active = false`, never by deleting the row, preserving the "preferences never silently expire, and the fact they once existed remains auditable" rule from the architecture doc §12/§16.

### Example record

```json
{
  "preference_type": "context_category_toggle",
  "factor_type": "political_civic",
  "factor_value": null,
  "instruction_text": "Don't use political or civic events as marketing context.",
  "is_active": true,
  "source": "explicit_statement"
}
```

---

## 6. `marketing_memory_overrides` — PROPOSED (not yet implemented)

**Phase:** 3
**Layer:** Customer Preferences (specifically, the override sub-type) / Outcomes (an override is also evidence of what happened after a Decision)
**Lifecycle:** Append-only.

### Responsibility

Records every time a customer's actual choice diverged from (or explicitly confirmed) a Marketing Director decision — never logged as an error, always evidence.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `decision_link_id` | `uuid null references marketing_memory_decision_links(id) on delete set null` | which Decision this responded to (Phase 4; nullable so Phase 3 can ship before Phase 4 exists) |
| `override_type` | `text not null` | `chose_different_action \| chose_different_time \| disabled_context_factor \| marked_learning_incorrect \| deferred_recommendation` — fixed vocabulary |
| `related_learning_id` | `uuid null references marketing_memory_learnings(id) on delete set null` | set when `override_type = 'marked_learning_incorrect'` — becomes a `contradicting` evidence link candidate for that Learning |
| `is_permanent` | `boolean not null default false` | when true, this override should be (or already was) promoted into a `marketing_memory_preferences` row |
| `promoted_to_preference_id` | `uuid null references marketing_memory_preferences(id) on delete set null` | set once promotion happens |
| `notes` | `text null` | optional free-text the customer entered, e.g. via "tell me more" |
| `idempotency_key` | `text not null unique` | `{decision_link_id}:{override_type}:{created_at_iso}` — best-effort dedupe; overrides are rare enough that strict idempotency matters less than for high-frequency tables |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, created_at desc)`
- `index (related_learning_id)`

### RLS

`select`, `insert` only — append-only, matching the architecture doc's "overrides should not be treated as errors... should become evidence" framing: you don't edit history, you add to it.

---

## 7. `marketing_memory_decision_links` — PROPOSED (not yet implemented)

**Phase:** 4
**Layer:** Decisions
**Lifecycle:** Append-only.

### Responsibility

An audit-trail record of one `MarketingDirectorDecision` (from `lib/marketing-director/types.ts`) actually computed for a customer, plus which Learnings/Preferences it consulted — **not** a new decision-making table. `lib/marketing-director/resolveDecision.ts` remains the sole place a decision is *made*; this table only records that it happened, matching the same "record, don't decide" boundary the architecture doc's §17 draws for the whole memory system.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `decision_type` | `text not null` | mirrors `MarketingDirectorDecisionType` (`meaningful_decision \| approval_needed \| high_value_recommendation \| opportunity \| reassurance \| celebration`) |
| `source_recommendation_id` | `uuid null references marketing_recommendations(id) on delete set null` | mirrors `MarketingDirectorDecision.sourceRecommendationId` |
| `consulted_learning_ids` | `uuid[] not null default '{}'` | which Learnings' evidence packages were consulted (references, not copies) |
| `consulted_preference_ids` | `uuid[] not null default '{}'` | which Preferences were consulted |
| `was_cold_start` | `boolean not null default false` | mirrors `MarketingMemoryEvidencePackage.isColdStart` |
| `evaluated_at` | `timestamptz not null` | mirrors `MarketingDirectorDecision.evaluatedAt` |
| `idempotency_key` | `text not null unique` | `{business_profile_id}:{evaluated_at_iso}` |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, evaluated_at desc)`
- `gin index (consulted_learning_ids)`

### RLS

`select`, `insert` only — append-only.

---

## 8. Relationships diagram (as-built through Phase 1)

```
business_profiles ──┬── marketing_memory_observations ──── context_snapshot_id → marketing_memory_context_snapshots
                     │        │  (exactly one of the two below is set, DB-enforced)         │ context_item_ids[] → market_context_items (existing, referenced not copied)
                     │        ├── source_outcome_event_id  → recommendation_outcome_events (existing)
                     │        └── source_analytics_snapshot_id → analytics_snapshots (existing)
                     │        │
                     │        └──(1..4 rows)──▶ marketing_memory_evidence_links
                     │                                (observation_id anchor; source_type/source_id polymorphic:
                     │                                 recommendation | content_approval | publishing_job |
                     │                                 recommendation_outcome_event | analytics_snapshot,
                     │                                 all → their existing tables)
                     │
                     │   [Phase 2, not yet implemented] marketing_memory_learnings
                     │   [Phase 3, not yet implemented] marketing_memory_preferences / marketing_memory_overrides
                     │   [Phase 4, not yet implemented] marketing_memory_decision_links
```

The original proposal's Learning-anchored evidence graph (`evidence_links.learning_id → marketing_memory_learnings`) remains the intended Phase 2 shape; a future migration adds a nullable `learning_id` column alongside `observation_id` rather than replacing it.

---

## 9. First-release vs. future scope summary

| Entity | Phase | Status | Depends on |
|---|---|---|---|
| `marketing_memory_observations` | 1 | **Implemented** | `recommendation_outcome_events`, `analytics_snapshots` (existing) |
| `marketing_memory_context_snapshots` | 1 | **Implemented** | `market_context_items` (existing) |
| `marketing_memory_evidence_links` | 1 (elevated from the original Phase 2 proposal) | **Implemented**, observation-anchored | Phase 1 `marketing_memory_observations` |
| `marketing_memory_learnings` | 2 | Proposed only | Phase 1 entities |
| `marketing_memory_preferences` | 3 | Proposed only | none (can ship independently of Phases 1–2) |
| `marketing_memory_overrides` | 3 | Proposed only | `marketing_memory_preferences`; `decision_link_id` FK nullable until Phase 4 |
| `marketing_memory_decision_links` | 4 | Proposed only | `marketing_memory_learnings`, `marketing_memory_preferences`, `marketing_recommendations` (existing) |

`marketing_memory_observations`, `marketing_memory_context_snapshots`, and `marketing_memory_evidence_links` were shipped together in `supabase/migrations/024_marketing_memory_foundation.sql`. `marketing_memory_learnings`, `marketing_memory_preferences`, `marketing_memory_overrides`, and `marketing_memory_decision_links` remain design proposals for later phases — no migration exists for them yet.

---

## 10. Idempotency strategy rationale

Two patterns are used, matching existing precedent exactly:

- **High-frequency, system-written tables** (`observations`, `context_snapshots`, `evidence_links`, and the future `decision_links`) use a single `idempotency_key text unique` column — matching `recommendation_outcome_events`' proven pattern for tables written by background/automated processes that might retry. As implemented: `observations` keys on `{business_profile_id}:{source_type}:{source_id}` (one observation per authoritative source event); `context_snapshots` keys on `{business_profile_id}:{utc-date}` (one snapshot reused per business per day, a get-or-create rather than a strict "first write wins" pattern); `evidence_links` keys on `{observation_id}:{source_type}:{source_id}` and is written via `upsert(..., { ignoreDuplicates: true })` rather than a plain insert, so one already-existing row in a batch never fails its siblings. Live-verified against the real database — see `MARKETING_MEMORY_FOUNDATION.md` §12.
- **Low-frequency, "at most one active" tables** (future `learnings`, `preferences`) use a **partial unique index** scoped to `status = 'active'` / `is_active = true` — matching `content_approvals_active_recommendation_idx`'s proven pattern for "only one current X," while still allowing unlimited historical rows to accumulate for audit purposes. Not yet implemented (Phase 2/3).

Future `overrides` will use a best-effort `idempotency_key` (not a hard business-uniqueness guarantee) since overrides are rare, user-initiated, single-shot events where duplicate-prevention matters less than for automated writes.
