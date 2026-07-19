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

## 3. `marketing_memory_learnings` — IMPLEMENTED

**Phase:** 2 (shipped in `025_marketing_memory_learnings.sql`)
**Layer:** Learnings
**Lifecycle:** Mutable — reconciliation updates a live row in place (§ "Reconciliation" in `MARKETING_MEMORY_LEARNINGS.md`); a **genuine direction reversal** supersedes the old row (status → `superseded`, `superseded_by_learning_id` set) and inserts a new one, rather than overwriting the conclusion in place.

### Responsibility

A named, confidence-scored, evidence-linked pattern claim, derived from Phase 1 observations by `lib/marketing-memory/learningEvaluation.ts`.

### As-built columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `learning_family` | `text not null` | `timing_performance \| recommendation_action_outcome` — intentionally limited to two families; see `MARKETING_MEMORY_LEARNINGS.md` §3 for why weather/event-attention are not implemented |
| `time_dimension` | `text null` | `day_of_week \| month \| season` — only for `timing_performance`; always null for `recommendation_action_outcome` |
| `subject_key` | `text not null` | the specific value measured: a day/month/season value, or a `recommended_action_type` value |
| `metric_key` | `text not null` | `performance_score \| approval_rate` |
| `direction` | `text not null` | `positive \| negative \| neutral \| inconclusive` — the Learning's own directional claim |
| `status` | `text not null default 'emerging'` | `emerging \| active \| weakening \| inconclusive \| superseded \| archived` |
| `confidence_level` | `text not null default 'early_signal'` | `early_signal \| developing_pattern \| strong_pattern` — **`confirmed_preference` is excluded from this check constraint entirely**, not just unused by application code |
| `confidence_components` | `jsonb not null default '{}'` | sample size, supporting/contradicting/neutral counts, consistency, contradiction rate, effect size, recency days, seasonal recurrence count, confounder codes — everything needed to answer "what would change this" without recomputing from raw observations |
| `sample_size` | `integer not null` | `check (sample_size >= 2)` |
| `supporting_count` / `contradicting_count` / `neutral_count` / `excluded_count` | `integer not null default 0` | denormalized for quick filtering without parsing `confidence_components` |
| `effect_size` | `numeric(7,4)` | signed, normalized relative effect, clamped to ±3.0 |
| `comparison_baseline` | `text not null` | human-readable, e.g. "trailing rolling average performance score for this business" |
| `baseline_value` / `cohort_value` | `numeric(10,4)` | the actual numbers behind `effect_size` |
| `first_observed_at` / `last_observed_at` | `timestamptz not null` | evidence date range |
| `evaluation_window_days` | `integer not null` | the lookback window used for this evaluation run (`EVALUATION_WINDOW_DAYS`, 180) |
| `recurrence_pattern` | `text not null default 'none'` | `none \| annual_month \| annual_range \| recurring_weekly` |
| `seasonal_recurrence_count` | `integer not null default 0` | distinct calendar years represented, for month/season dimensions only |
| `confounder_codes` | `text[] not null default '{}'` | closed vocabulary, e.g. `estimated_performance_metric`, `small_sample` |
| `summary` | `text not null` | customer-safe, correlation-aware, template-generated — never free-form |
| `internal_rationale` | `text not null` | internal-only, may reference raw component values |
| `learning_key` | `text not null` | deterministic: `{business_profile_id}:{learning_family}:{time_dimension\|none}:{subject_key}:{metric_key}` |
| `superseded_by_learning_id` | `uuid null references marketing_memory_learnings(id) on delete set null` | |
| `schema_version` | `smallint not null default 1` | |
| `evaluated_at` / `created_at` / `updated_at` | `timestamptz` | `updated_at` trigger on every reconciliation |

**Deviations from the original proposal**: `learning_type` (a single, catch-all field spanning nine categories including unimplemented families like `weather`/`sports_entertainment`/`political_civic`) is replaced by two narrower, orthogonal fields (`learning_family` + `time_dimension`), reflecting the two families actually implemented. `date_range_start`/`date_range_end` (dates) became `first_observed_at`/`last_observed_at` (timestamps, matching the timestamp granularity Phase 1 observations already use). `consistency` and `recurrence_value` were folded into `confidence_components` (consistency) and `subject_key` (recurrence value is just the subject key for timing families) rather than kept as separate top-level columns. `dedupe_key` was renamed `learning_key` for clarity, same purpose. `active_until` was dropped — decay for this phase is entirely the read-time `status` + `confidence_components.recencyDays`/`seasonalRecurrenceCount` combination (§ Recency and Decay in `MARKETING_MEMORY_LEARNINGS.md`), not a stored expiry timestamp.

### Indexes / uniqueness

- `unique index on (business_profile_id, learning_key) where status in ('emerging','active','weakening','inconclusive')` — the as-built partial unique index (`marketing_memory_learnings_live_key_idx`), covering four "live" statuses rather than just `active`, since `emerging`/`weakening`/`inconclusive` are equally "currently representing this pattern." Live-verified (`MARKETING_MEMORY_LEARNINGS.md` §12): a second live insert for the same key correctly fails with `23505`, and marking a row `superseded` correctly frees the slot.
- `index (business_profile_id, status)`, `index (business_profile_id, learning_family)`, `index (learning_key)`, `index (confidence_level)`

### RLS

`select`/`insert`/`update` for `auth.uid() = user_id`. **No `delete` policy** — Learnings are never deleted, only superseded, enforced at the database layer. Live-verified: anonymous select returns `[]`, anonymous insert returns Postgres `42501`.

### Example record (as inserted by `lib/marketing-memory/learningPersistence.ts`)

```json
{
  "learning_family": "timing_performance",
  "time_dimension": "day_of_week",
  "subject_key": "thursday",
  "metric_key": "performance_score",
  "direction": "positive",
  "status": "active",
  "confidence_level": "developing_pattern",
  "sample_size": 9,
  "supporting_count": 7,
  "contradicting_count": 2,
  "comparison_baseline": "trailing rolling average performance score for this business",
  "recurrence_pattern": "recurring_weekly",
  "confounder_codes": ["estimated_performance_metric"],
  "summary": "There's a developing pattern: Posts published on Thursdays have historically performed better for your business.",
  "learning_key": "9e21...:timing_performance:day_of_week:thursday:performance_score"
}
```

---

## 4. `marketing_memory_evidence_links` — IMPLEMENTED (Phase 1 shape, extended in Phase 2)

**Phase:** 1 (first shipped in `024_marketing_memory_foundation.sql`) — **elevated from the original Phase 2 proposal**, then extended (not replaced) by `025_marketing_memory_learnings.sql` to also support learning-anchored rows, exactly as promised in `MARKETING_MEMORY_FOUNDATION.md`.
**Layer:** Evidence attribution (Observations → their source records, **and now** Learnings → their supporting/contradicting observations)
**Lifecycle:** Append-only.

### Responsibility

Polymorphic join from **either an observation or a learning** to every source record it references — the concrete mechanism behind "where did this evidence come from."

### Deviation from the original proposal

The original data-model document scoped this table to Phase 2 only, anchored solely on `learning_id`. Phase 1 elevated it early, anchored on `observation_id` instead (see the Phase 1 write-up this section used to contain). Phase 2 (migration 025) now adds the originally-proposed `learning_id` anchor **alongside** `observation_id` — via an additive `ALTER`, not a table rewrite: `observation_id` became nullable, `learning_id` (nullable FK to `marketing_memory_learnings`) and `contribution` (nullable, `supporting | contradicting | neutral | excluded`) were added, `link_type` became nullable (meaningful only for observation-anchored rows), `source_type`'s check constraint gained `'observation'` (so a learning can cite an observation as its evidence), and a new `exactly-one-anchor` check constraint replaced the old `observation_id not null` requirement. Every Phase 1 row remains valid and untouched under the new constraints — live-verified (`MARKETING_MEMORY_LEARNINGS.md` §12).

### As-built columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `observation_id` | `uuid null references marketing_memory_observations(id) on delete cascade` | set for Phase 1 rows; null for Phase 2 learning-anchored rows |
| `learning_id` | `uuid null references marketing_memory_learnings(id) on delete cascade` | **new in Phase 2**; set for learning-anchored rows; null for Phase 1 rows |
| `source_type` | `text not null` | `recommendation \| recommendation_outcome_event \| content_approval \| publishing_job \| analytics_snapshot \| market_context_item (reserved) \| monthly_focus (reserved) \| observation (new in Phase 2)` — `check` constrained |
| `source_id` | `uuid not null` | polymorphic id — no FK constraint possible across the source tables; validity enforced at the application layer (`lib/marketing-memory/types.ts`'s `MarketingMemorySourceEntityTypes`) |
| `link_type` | `text null default 'related_source'` | `primary_source \| related_source` — meaningful only for observation-anchored (Phase 1) rows; null for learning-anchored rows, where `contribution` carries the meaning instead |
| `contribution` | `text null` | **new in Phase 2**: `supporting \| contradicting \| neutral \| excluded` — meaningful only for learning-anchored rows |
| `idempotency_key` | `text not null unique` | `{observation_id}:{source_type}:{source_id}` for Phase 1 rows; `{learning_id}:{source_type}:{source_id}` for Phase 2 rows |
| `created_at` | `timestamptz not null default now()` | |

**Known limitation** (see `MARKETING_MEMORY_LEARNINGS.md` §2/§15): if a learning-anchored row's `contribution` would change on re-evaluation (an observation reclassified from supporting to contradicting), the existing row is **not** rewritten — this table stays append-only by design. The Learning row's own `supporting_count`/`contradicting_count`/`confidence_components` remain the current-state source of truth.

### Indexes

- `unique (idempotency_key)`
- `index (observation_id)`
- `index (source_type, source_id)`
- `index (learning_id) where learning_id is not null` — **new in Phase 2**

### RLS

`select`, `insert` only — append-only, unchanged by the Phase 2 `ALTER`. Live-verified: the `exactly-one-anchor` check rejects a row with both (or neither) anchor set; a fabricated Phase-1-style `observation_id` still correctly hits the real FK constraint (`23503`), proving the anchor check didn't interfere with Phase 1's existing shape.

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

## 8. Relationships diagram (as-built through Phase 2)

```
business_profiles ──┬── marketing_memory_observations ──── context_snapshot_id → marketing_memory_context_snapshots
                     │        │  (exactly one of the two below is set, DB-enforced)         │ context_item_ids[] → market_context_items (existing, referenced not copied)
                     │        ├── source_outcome_event_id  → recommendation_outcome_events (existing)
                     │        └── source_analytics_snapshot_id → analytics_snapshots (existing)
                     │        │
                     │        └──(1..4 rows, observation-anchored)──▶ marketing_memory_evidence_links
                     │                                (source_type/source_id polymorphic:
                     │                                 recommendation | content_approval | publishing_job |
                     │                                 recommendation_outcome_event | analytics_snapshot)
                     │
                     └── marketing_memory_learnings (Phase 2)
                              │  learning_family: timing_performance | recommendation_action_outcome
                              │  superseded_by_learning_id → marketing_memory_learnings (self, on direction flip)
                              │
                              └──(supporting/contradicting rows, learning-anchored)──▶ marketing_memory_evidence_links
                                       (source_type: 'observation', source_id → marketing_memory_observations,
                                        contribution: supporting | contradicting)

   [Phase 3, not yet implemented] marketing_memory_preferences / marketing_memory_overrides
   [Phase 4, not yet implemented] marketing_memory_decision_links
```

`marketing_memory_evidence_links` is now a single table serving both anchors (exactly one of `observation_id`/`learning_id` set per row, DB-enforced) — see §4.

---

## 9. First-release vs. future scope summary

| Entity | Phase | Status | Depends on |
|---|---|---|---|
| `marketing_memory_observations` | 1 | **Implemented** | `recommendation_outcome_events`, `analytics_snapshots` (existing) |
| `marketing_memory_context_snapshots` | 1 | **Implemented** | `market_context_items` (existing) |
| `marketing_memory_evidence_links` | 1 (elevated), extended in Phase 2 | **Implemented**, dual-anchored (observation or learning) | Phase 1 `marketing_memory_observations`; Phase 2 `marketing_memory_learnings` |
| `marketing_memory_learnings` | 2 | **Implemented** | Phase 1 `marketing_memory_observations`/`marketing_memory_context_snapshots`; `marketing_recommendations` (existing, for `recommendation_action_outcome`) |
| `marketing_memory_preferences` | 3 | Proposed only | none (can ship independently of Phases 1–2) |
| `marketing_memory_overrides` | 3 | Proposed only | `marketing_memory_preferences`; `decision_link_id` FK nullable until Phase 4 |
| `marketing_memory_decision_links` | 4 | Proposed only | `marketing_memory_learnings`, `marketing_memory_preferences`, `marketing_recommendations` (existing) |

`marketing_memory_observations`, `marketing_memory_context_snapshots`, and `marketing_memory_evidence_links` were shipped together in `supabase/migrations/024_marketing_memory_foundation.sql`. `marketing_memory_learnings` (plus the `evidence_links` extension) shipped in `supabase/migrations/025_marketing_memory_learnings.sql`. `marketing_memory_preferences`, `marketing_memory_overrides`, and `marketing_memory_decision_links` remain design proposals for later phases — no migration exists for them yet.

---

## 10. Idempotency strategy rationale

Two patterns are used, matching existing precedent exactly:

- **High-frequency, system-written tables** (`observations`, `context_snapshots`, `evidence_links`, and the future `decision_links`) use a single `idempotency_key text unique` column — matching `recommendation_outcome_events`' proven pattern for tables written by background/automated processes that might retry. As implemented: `observations` keys on `{business_profile_id}:{source_type}:{source_id}` (one observation per authoritative source event); `context_snapshots` keys on `{business_profile_id}:{utc-date}` (one snapshot reused per business per day, a get-or-create rather than a strict "first write wins" pattern); `evidence_links` keys on `{observation_id}:{source_type}:{source_id}` and is written via `upsert(..., { ignoreDuplicates: true })` rather than a plain insert, so one already-existing row in a batch never fails its siblings. Live-verified against the real database — see `MARKETING_MEMORY_FOUNDATION.md` §12.
- **Low-frequency, "at most one active" tables** (future `learnings`, `preferences`) use a **partial unique index** scoped to `status = 'active'` / `is_active = true` — matching `content_approvals_active_recommendation_idx`'s proven pattern for "only one current X," while still allowing unlimited historical rows to accumulate for audit purposes. Not yet implemented (Phase 2/3).

Future `overrides` will use a best-effort `idempotency_key` (not a hard business-uniqueness guarantee) since overrides are rare, user-initiated, single-shot events where duplicate-prevention matters less than for automated writes.
