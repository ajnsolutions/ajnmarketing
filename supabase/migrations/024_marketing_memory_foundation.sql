-- Marketing Memory Phase 1: observation and evidence foundation. See
-- docs/MARKETING_MEMORY_FOUNDATION.md for the full design rationale and
-- docs/MARKETING_MEMORY_DATA_MODEL.md for field-level documentation.
--
-- This migration implements exactly three tables, all append-only, all factual:
--   marketing_memory_context_snapshots -- what conditions surrounded an observation
--   marketing_memory_observations       -- what happened
--   marketing_memory_evidence_links     -- where the evidence came from
--
-- No learnings, confidence scores, preferences, or overrides are added here -- those
-- are later phases per docs/MARKETING_MEMORY_ARCHITECTURE.md's phased plan. This phase
-- exists purely to start recording durable, tenant-scoped, idempotent evidence from a
-- small set of already-authoritative events (recommendation_outcome_events,
-- analytics_snapshots) without changing anything about how those events are produced.
--
-- Deviation from docs/MARKETING_MEMORY_DATA_MODEL.md, documented here and in
-- docs/MARKETING_MEMORY_FOUNDATION.md: that document scoped marketing_memory_
-- evidence_links to Phase 2, anchored on a (not-yet-built) marketing_memory_learnings
-- row. This implementation task explicitly elevates evidence_links into Phase 1,
-- anchored on marketing_memory_observations instead, since no Learnings exist yet. A
-- future Phase 2 migration can add a nullable learning_id column without breaking this
-- shape. observation.source_recommendation_id / source_content_approval_id /
-- source_publishing_job_id from the original doc are represented as evidence_links rows
-- (source_type + link_type = 'related_source') instead of direct nullable columns on
-- the observations table, keeping that table narrow (one strongly-typed "primary
-- source" FK pair) while evidence_links carries every additional related reference.

create table if not exists public.marketing_memory_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  -- The real-world moment this snapshot describes conditions for (usually the
  -- occurred_at of the observation that triggered its creation).
  captured_at timestamptz not null,
  -- References into existing market_context_items -- never copied. Bounded to a small
  -- set (see lib/marketing-memory ingestion, which caps this at 5 items) so this column
  -- never grows unboundedly per row.
  context_item_ids uuid[] not null default '{}',
  -- Small, deterministically computed calendar facts only (day of week, month, season).
  -- Never a derived pattern or claim -- see the "no learnings" constraint above.
  context_summary jsonb not null default '{}'::jsonb,
  -- Phase 1 never classifies impact -- that requires interpretation, which belongs to a
  -- future Learning layer. Always 'unknown' until Phase 2.
  impact_direction text not null default 'unknown'
    check (impact_direction in ('positive', 'negative', 'neutral', 'unknown')),
  observed_vs_forecast text not null default 'observed'
    check (observed_vs_forecast in ('observed', 'forecast')),
  -- Every append-only memory record carries a retention classification. Context
  -- snapshots are the fastest-decaying evidence in this schema (see the architecture
  -- doc's self-review on unbounded growth), so this is always short_lived_context in
  -- Phase 1 -- the column still carries a full check constraint for forward
  -- compatibility with later phases that may introduce longer-lived snapshots.
  retention_classification text not null default 'short_lived_context'
    check (
      retention_classification in (
        'short_lived_context',
        'standard_operational_evidence',
        'long_term_audit_evidence'
      )
    ),
  valid_from timestamptz not null,
  valid_until timestamptz,
  -- Explicit retention boundary, required by the architecture self-review's "unbounded
  -- storage growth" finding. No cleanup job runs in this PR (see
  -- docs/MARKETING_MEMORY_FOUNDATION.md); this column only makes expired rows
  -- distinguishable via a read-time query, never a background delete.
  expires_at timestamptz not null,
  -- Deterministic, server-computed: "ctx:<business_profile_id>:<utc-date>" -- one
  -- snapshot reused per business per UTC day, never client-supplied.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint marketing_memory_context_snapshots_idempotency_key unique (idempotency_key)
);

create index if not exists marketing_memory_context_snapshots_business_captured_idx
  on public.marketing_memory_context_snapshots (business_profile_id, captured_at desc);
create index if not exists marketing_memory_context_snapshots_user_id_idx
  on public.marketing_memory_context_snapshots (user_id);
create index if not exists marketing_memory_context_snapshots_context_item_ids_idx
  on public.marketing_memory_context_snapshots using gin (context_item_ids);
create index if not exists marketing_memory_context_snapshots_expires_at_idx
  on public.marketing_memory_context_snapshots (expires_at);

alter table public.marketing_memory_context_snapshots enable row level security;

-- Append-only by policy: select + insert only, matching recommendation_outcome_events'
-- precedent exactly. A fact, once recorded, is never edited -- only superseded by a new
-- fact in a future phase's Learning layer.
create policy "Users can view own marketing memory context snapshots"
  on public.marketing_memory_context_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory context snapshots"
  on public.marketing_memory_context_snapshots
  for insert
  with check (auth.uid() = user_id);

create table if not exists public.marketing_memory_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  observation_type text not null check (
    observation_type in (
      'recommendation_drafted',
      'recommendation_edited',
      'recommendation_approved',
      'recommendation_rejected',
      'recommendation_do_more_like_this',
      'publishing_queued',
      'publishing_succeeded',
      'publishing_failed',
      'performance_measured',
      'analytics_snapshot_captured'
    )
  ),
  -- Which existing subsystem produced this observation. Diagnostic/filtering only.
  source_system text not null check (source_system in ('recommendation-outcomes', 'analytics')),
  -- Exactly one of these two is set (enforced below), identifying the single
  -- authoritative row that directly caused this observation to be recorded. Every other
  -- related record (the recommendation itself, a content approval, a publishing job) is
  -- captured as a marketing_memory_evidence_links row instead of an additional nullable
  -- column here, keeping this table's "primary source" narrow and strongly typed.
  source_outcome_event_id uuid references public.recommendation_outcome_events (id) on delete set null,
  source_analytics_snapshot_id uuid references public.analytics_snapshots (id) on delete set null,
  context_snapshot_id uuid references public.marketing_memory_context_snapshots (id) on delete set null,
  -- When the underlying real-world event happened -- distinct from created_at (when we
  -- recorded it). For Phase 1's synchronous ingestion these are typically close, but the
  -- distinction matters for any future backfill/reconciliation pass.
  occurred_at timestamptz not null,
  -- Factual outcome category only -- never an interpretation of *why*. See
  -- docs/MARKETING_MEMORY_FOUNDATION.md for the exact, non-inferential
  -- observation_type -> outcome_direction mapping used by the ingestion code.
  -- performance_measured is always 'unknown' in Phase 1: judging whether a metric is
  -- good or bad requires a baseline comparison, which is Learning-layer work.
  outcome_direction text not null default 'unknown'
    check (outcome_direction in ('positive', 'negative', 'neutral', 'mixed', 'unknown')),
  -- Reserved for a future multi-location business; always null in Phase 1 (every
  -- business_profiles row today is single-location).
  location_scope text,
  -- Small, structured facts only (e.g. { "views": 100, "clicks": 10 }) -- never a copy
  -- of a full analytics/provider payload. Bounded and validated in
  -- lib/marketing-memory/metadata.ts.
  metric_summary jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1,
  -- Every recommendation-outcome-derived observation type inherits
  -- recommendation_outcome_events' own "durable source of truth" treatment
  -- (long_term_audit_evidence). analytics_snapshot_captured observations are daily
  -- operational cadence facts (standard_operational_evidence). See
  -- docs/MARKETING_MEMORY_FOUNDATION.md for the exact mapping table.
  retention_classification text not null check (
    retention_classification in (
      'short_lived_context',
      'standard_operational_evidence',
      'long_term_audit_evidence'
    )
  ),
  -- Deterministic, server-computed: "obs:<business_profile_id>:<source_type>:<source_id>"
  -- -- never client-supplied. Guarantees at most one observation per authoritative
  -- source event, even if the ingestion hook is invoked more than once.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint marketing_memory_observations_idempotency_key unique (idempotency_key),
  constraint marketing_memory_observations_exactly_one_primary_source check (
    (
      (source_outcome_event_id is not null)::int
      + (source_analytics_snapshot_id is not null)::int
    ) = 1
  )
);

create index if not exists marketing_memory_observations_business_occurred_idx
  on public.marketing_memory_observations (business_profile_id, occurred_at desc);
create index if not exists marketing_memory_observations_user_id_idx
  on public.marketing_memory_observations (user_id);
create index if not exists marketing_memory_observations_observation_type_idx
  on public.marketing_memory_observations (observation_type);
create index if not exists marketing_memory_observations_outcome_event_idx
  on public.marketing_memory_observations (source_outcome_event_id)
  where source_outcome_event_id is not null;
create index if not exists marketing_memory_observations_analytics_snapshot_idx
  on public.marketing_memory_observations (source_analytics_snapshot_id)
  where source_analytics_snapshot_id is not null;
create index if not exists marketing_memory_observations_context_snapshot_idx
  on public.marketing_memory_observations (context_snapshot_id)
  where context_snapshot_id is not null;

alter table public.marketing_memory_observations enable row level security;

create policy "Users can view own marketing memory observations"
  on public.marketing_memory_observations
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory observations"
  on public.marketing_memory_observations
  for insert
  with check (auth.uid() = user_id);

create table if not exists public.marketing_memory_evidence_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  observation_id uuid not null references public.marketing_memory_observations (id) on delete cascade,
  -- Central, closed vocabulary of supported source entity types -- the mechanism that
  -- prevents arbitrary unvalidated source-type strings from spreading through the
  -- codebase (mirrored in lib/marketing-memory/types.ts as
  -- MarketingMemorySourceEntityTypes, the single place both this constraint and the
  -- application layer's validation are derived from). 'monthly_focus' is reserved for a
  -- future phase: Monthly Focus is currently a computed-on-demand value with no
  -- persisted row, so no Phase 1 ingestion path can populate this value yet -- see
  -- docs/MARKETING_MEMORY_FOUNDATION.md.
  source_type text not null check (
    source_type in (
      'recommendation',
      'recommendation_outcome_event',
      'content_approval',
      'publishing_job',
      'analytics_snapshot',
      'market_context_item',
      'monthly_focus'
    )
  ),
  -- Polymorphic id -- no FK constraint is possible across six source tables. Validity is
  -- enforced at the application layer (lib/marketing-memory), matching how
  -- market_context_items.metadata already stores loosely-typed provenance without a
  -- hard FK (see docs/MARKETING_MEMORY_DATA_MODEL.md).
  source_id uuid not null,
  link_type text not null default 'related_source'
    check (link_type in ('primary_source', 'related_source')),
  -- Deterministic: "<observation_id>:<source_type>:<source_id>" -- never client-supplied.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint marketing_memory_evidence_links_idempotency_key unique (idempotency_key)
);

create index if not exists marketing_memory_evidence_links_observation_id_idx
  on public.marketing_memory_evidence_links (observation_id);
create index if not exists marketing_memory_evidence_links_source_idx
  on public.marketing_memory_evidence_links (source_type, source_id);
create index if not exists marketing_memory_evidence_links_user_id_idx
  on public.marketing_memory_evidence_links (user_id);

alter table public.marketing_memory_evidence_links enable row level security;

create policy "Users can view own marketing memory evidence links"
  on public.marketing_memory_evidence_links
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory evidence links"
  on public.marketing_memory_evidence_links
  for insert
  with check (auth.uid() = user_id);
