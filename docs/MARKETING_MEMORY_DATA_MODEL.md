# Marketing Memory — Proposed Data Model

**Type:** Design document. **No migration files are added or changed by this PR.** Every table below is a proposal for a future phase (see `MARKETING_MEMORY_ARCHITECTURE.md` §20). Column names, types, and constraints follow this repository's existing migration conventions exactly (`supabase/migrations/001`–`022`) so a future migration PR can implement this with minimal translation.

Companion document: [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) (read first — this document assumes its layer definitions, precedence order, and confidence model).

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

## 1. `marketing_memory_observations`

**Phase:** 1 (first release)
**Layer:** Observations
**Lifecycle:** Append-only. Never updated or deleted except by cascade.

### Responsibility

One row per factual, attributable event-plus-context snapshot. Never a conclusion — a Learning is derived *from* many Observations, never stored here.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | tenant owner |
| `business_profile_id` | `uuid not null` | tenant scope |
| `observation_type` | `text not null` | `publishing_event \| performance_delta \| context_present \| customer_action` — a small fixed vocabulary, `check` constrained |
| `occurred_at` | `timestamptz not null` | when the underlying real-world event happened (not `created_at`, which is when we recorded it) |
| `source_recommendation_id` | `uuid null references marketing_recommendations(id) on delete set null` | reference, not copy |
| `source_outcome_event_id` | `uuid null references recommendation_outcome_events(id) on delete set null` | reference, not copy |
| `source_content_approval_id` | `uuid null references content_approvals(id) on delete set null` | reference |
| `context_snapshot_id` | `uuid null references marketing_memory_context_snapshots(id) on delete set null` | which context was active (§2) |
| `metric_summary` | `jsonb not null default '{}'` | small, structured facts only, e.g. `{"impressions_delta_pct": 12, "baseline_window_days": 28}` — never a copy of a full analytics row |
| `idempotency_key` | `text not null unique` | e.g. `obs:{business_profile_id}:{source_outcome_event_id}:{observation_type}` — prevents duplicate observation rows if the recording job re-runs |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, occurred_at desc)` — the primary read path (Phase 2's Learning derivation scans recent observations per business)
- `index (observation_type)`

### RLS

`select`, `insert` only for `auth.uid() = user_id`. No `update`/`delete` policy — matches `recommendation_outcome_events`' append-only precedent exactly, for the same reason: a fact, once recorded, is never edited, only superseded by a new fact.

### Example record

```json
{
  "observation_type": "performance_delta",
  "occurred_at": "2026-06-11T09:00:00Z",
  "source_recommendation_id": "6c9f...",
  "source_outcome_event_id": "a1b2...",
  "context_snapshot_id": "f00d...",
  "metric_summary": { "impressions_delta_pct": 12, "calls_delta_pct": -4, "baseline_window_days": 28 },
  "idempotency_key": "obs:9e21...:a1b2...:performance_delta"
}
```

---

## 2. `marketing_memory_context_snapshots`

**Phase:** 1 (first release)
**Layer:** Observations (the "what conditions surrounded it" half)
**Lifecycle:** Append-only.

### Responsibility

Captures which `market_context_items` (and, in the future, sports/entertainment or political/civic signals) were active at the moment an Observation was recorded — without copying their full content. This is the normalization boundary described in the architecture doc's §14, materialized as a table.

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `captured_at` | `timestamptz not null` | when this snapshot was taken (matches the related observation's `occurred_at` window) |
| `context_item_ids` | `uuid[] not null default '{}'` | references into existing `market_context_items` — **not copied** |
| `impact_direction` | `text null` | `positive \| negative \| neutral \| unknown` — classified at snapshot time if determinable, else `unknown` |
| `observed_vs_forecast` | `text not null default 'observed'` | `observed \| forecast` |
| `idempotency_key` | `text not null unique` | e.g. `ctx:{business_profile_id}:{captured_at_iso}` |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (business_profile_id, captured_at desc)`
- `gin index (context_item_ids)` — matches the existing GIN-index precedent on `marketing_recommendations.related_opportunity_ids`

### RLS

`select`, `insert` only — append-only, same rationale as §1.

---

## 3. `marketing_memory_learnings`

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

## 4. `marketing_memory_evidence_links`

**Phase:** 2
**Layer:** Evidence attribution (spans Observations → Learnings)
**Lifecycle:** Append-only.

### Responsibility

Polymorphic join between a Learning and every piece of evidence that supports or contradicts it — the concrete mechanism behind "what evidence supports/would weaken this."

### Candidate columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | |
| `business_profile_id` | `uuid not null` | |
| `learning_id` | `uuid not null references marketing_memory_learnings(id) on delete cascade` | |
| `source_type` | `text not null` | `observation \| recommendation \| outcome_event \| analytics_snapshot \| context_item \| override` — `check` constrained |
| `source_id` | `uuid not null` | polymorphic id — no FK constraint possible across the six source tables; validity enforced at the application layer, matching how `market_context_items.metadata` already stores loosely-typed provenance without a hard FK |
| `contribution` | `text not null` | `supporting \| contradicting \| neutral` |
| `idempotency_key` | `text not null unique` | `{learning_id}:{source_type}:{source_id}` |
| `created_at` | `timestamptz not null default now()` | |

### Indexes

- `unique (idempotency_key)`
- `index (learning_id)`
- `index (source_type, source_id)`

### RLS

`select`, `insert` only — append-only.

---

## 5. `marketing_memory_preferences`

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

## 6. `marketing_memory_overrides`

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

## 7. `marketing_memory_decision_links`

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

## 8. Relationships diagram

```
business_profiles ──┬── marketing_memory_observations ──┬── context_snapshot_id → marketing_memory_context_snapshots
                     │        │                          ├── source_recommendation_id → marketing_recommendations (existing)
                     │        │                          ├── source_outcome_event_id  → recommendation_outcome_events (existing)
                     │        │                          └── source_content_approval_id → content_approvals (existing)
                     │        │
                     │        └──(many)──▶ marketing_memory_evidence_links ──▶ marketing_memory_learnings
                     │                            (source_type/source_id polymorphic)      │
                     │                                                                       │ recurrence_pattern
                     │                                                                       │ confidence_level
                     ├── marketing_memory_preferences ◀── promoted_from_override_id ─┐        │
                     │                                                                 │        │
                     └── marketing_memory_overrides ──── promoted_to_preference_id ──┘        │
                                    │                                                            │
                                    └── decision_link_id ─────▶ marketing_memory_decision_links ◀┘
                                                                          │
                                                                          └── source_recommendation_id → marketing_recommendations (existing)
```

---

## 9. First-release vs. future scope summary

| Entity | Phase | Depends on |
|---|---|---|
| `marketing_memory_observations` | 1 | `marketing_recommendations`, `recommendation_outcome_events`, `content_approvals` (existing) |
| `marketing_memory_context_snapshots` | 1 | `market_context_items` (existing) |
| `marketing_memory_learnings` | 2 | Phase 1 entities |
| `marketing_memory_evidence_links` | 2 | Phase 1 + `marketing_memory_learnings` |
| `marketing_memory_preferences` | 3 | none (can ship independently of Phases 1–2) |
| `marketing_memory_overrides` | 3 | `marketing_memory_preferences`; `decision_link_id` FK nullable until Phase 4 |
| `marketing_memory_decision_links` | 4 | `marketing_memory_learnings`, `marketing_memory_preferences`, `marketing_recommendations` (existing) |

**No migration is included in this PR.** This table exists so a future implementation PR can translate directly into `supabase/migrations/0XX_marketing_memory_*.sql` files, phased exactly as listed.

---

## 10. Idempotency strategy rationale

Two patterns are used, matching existing precedent exactly:

- **High-frequency, system-written tables** (`observations`, `context_snapshots`, `evidence_links`, `decision_links`) use a single `idempotency_key text unique` column — matching `recommendation_outcome_events`' proven pattern for tables written by background/automated processes that might retry.
- **Low-frequency, "at most one active" tables** (`learnings`, `preferences`) use a **partial unique index** scoped to `status = 'active'` / `is_active = true` — matching `content_approvals_active_recommendation_idx`'s proven pattern for "only one current X," while still allowing unlimited historical rows to accumulate for audit purposes.

`overrides` uses a best-effort `idempotency_key` (not a hard business-uniqueness guarantee) since overrides are rare, user-initiated, single-shot events where duplicate-prevention matters less than for automated writes.
