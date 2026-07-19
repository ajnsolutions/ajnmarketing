-- Marketing Memory Phase 2: learnings and confidence. See
-- docs/MARKETING_MEMORY_LEARNINGS.md for the full design rationale.
--
-- This migration does two things:
--   1. Creates marketing_memory_learnings -- cautious, evidence-backed, revisable
--      conclusions derived from Phase 1 observations. Mutable (reconciled in place)
--      unlike Phase 1's append-only tables, but never deleted -- only superseded.
--   2. Extends marketing_memory_evidence_links (added in 024, unmodified by this
--      migration's own DDL for that table's *creation* -- only ALTERed here) so a row
--      can anchor on either an observation (Phase 1 shape, unchanged) or a learning
--      (Phase 2: "this observation is evidence for this learning"), exactly as promised
--      in docs/MARKETING_MEMORY_FOUNDATION.md's Phase 1 write-up: "A future Phase 2
--      migration can add a nullable learning_id column without breaking this shape."
--
-- Migration 024 itself is not modified -- every change to marketing_memory_evidence_links
-- here is an additive ALTER, and all Phase 1 rows (observation_id set, learning_id null)
-- remain valid and untouched under the new constraints.
--
-- No customer preferences, overrides, or Marketing Director consumption exist in this
-- migration or the code that uses it. confidence_level's check constraint deliberately
-- excludes 'confirmed_preference' -- that value has no valid row to produce yet, and the
-- database itself refuses it, not just application code.

create table if not exists public.marketing_memory_learnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  -- Intentionally limited, closed vocabulary -- see docs/MARKETING_MEMORY_LEARNINGS.md
  -- for why weather/event-attention families are not implemented in Phase 2 (Phase 1
  -- never classified impact_direction beyond 'unknown', so no honest directional signal
  -- exists yet to learn from).
  learning_family text not null check (
    learning_family in ('timing_performance', 'recommendation_action_outcome')
  ),
  -- Only meaningful for timing_performance; null for recommendation_action_outcome.
  time_dimension text check (time_dimension in ('day_of_week', 'month', 'season')),
  -- The specific value being measured within the family: a day/month/season name for
  -- timing_performance, or a recommended_action_type value for
  -- recommendation_action_outcome.
  subject_key text not null,
  metric_key text not null check (metric_key in ('performance_score', 'approval_rate')),
  -- The learning's own directional claim -- distinct from any individual observation's
  -- outcome_direction. 'inconclusive' means evidence exists but never resolved to a
  -- clear net direction (a first-class, honest outcome, not an error).
  direction text not null check (direction in ('positive', 'negative', 'neutral', 'inconclusive')),
  status text not null default 'emerging' check (
    status in ('emerging', 'active', 'weakening', 'inconclusive', 'superseded', 'archived')
  ),
  -- 'confirmed_preference' is deliberately NOT a valid value here -- reserved for a
  -- future phase once explicit customer preferences exist; the database refuses it.
  confidence_level text not null default 'early_signal' check (
    confidence_level in ('early_signal', 'developing_pattern', 'strong_pattern')
  ),
  -- The documented component values behind confidence_level -- see
  -- lib/marketing-memory/learningConfig.ts for the exact, centralized formula. Stored so
  -- "what evidence supports this / what would change it" is always answerable without
  -- recomputing from raw observations.
  confidence_components jsonb not null default '{}'::jsonb,
  sample_size integer not null check (sample_size >= 2),
  supporting_count integer not null default 0,
  contradicting_count integer not null default 0,
  neutral_count integer not null default 0,
  excluded_count integer not null default 0,
  -- Signed, normalized relative effect (cohort vs. baseline). Sign matches `direction`.
  effect_size numeric(7, 4),
  comparison_baseline text not null,
  baseline_value numeric(10, 4),
  cohort_value numeric(10, 4),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  evaluation_window_days integer not null check (evaluation_window_days > 0),
  recurrence_pattern text not null default 'none' check (
    recurrence_pattern in ('none', 'annual_month', 'annual_range', 'recurring_weekly')
  ),
  seasonal_recurrence_count integer not null default 0,
  -- Structured reason codes only -- never generated speculation. See
  -- docs/MARKETING_MEMORY_LEARNINGS.md for the closed vocabulary.
  confounder_codes text[] not null default '{}',
  -- Customer-safe, correlation-aware, template-generated -- never causal language. See
  -- lib/marketing-memory/rationale.ts and its forbidden-terms test.
  summary text not null,
  -- Internal-only, may reference raw numbers/component values -- never shown to a
  -- customer verbatim.
  internal_rationale text not null,
  -- Deterministic: "<business_profile_id>:<learning_family>:<time_dimension|none>:
  -- <subject_key>:<metric_key>" -- identifies "this same pattern," independent of which
  -- specific row currently represents its live state.
  learning_key text not null,
  superseded_by_learning_id uuid references public.marketing_memory_learnings (id) on delete set null,
  schema_version smallint not null default 1,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one "live" (currently-representing-this-pattern) row per learning_key per
-- business. 'superseded' and 'archived' rows are historical and may accumulate freely --
-- this is the same "at most one active X" partial-unique-index pattern already
-- established by content_approvals_active_recommendation_idx (019) and this schema's own
-- proposed (not yet built) marketing_memory_learnings design in
-- docs/MARKETING_MEMORY_DATA_MODEL.md.
create unique index if not exists marketing_memory_learnings_live_key_idx
  on public.marketing_memory_learnings (business_profile_id, learning_key)
  where status in ('emerging', 'active', 'weakening', 'inconclusive');

create index if not exists marketing_memory_learnings_business_status_idx
  on public.marketing_memory_learnings (business_profile_id, status);
create index if not exists marketing_memory_learnings_business_family_idx
  on public.marketing_memory_learnings (business_profile_id, learning_family);
create index if not exists marketing_memory_learnings_learning_key_idx
  on public.marketing_memory_learnings (learning_key);
create index if not exists marketing_memory_learnings_confidence_idx
  on public.marketing_memory_learnings (confidence_level);
create index if not exists marketing_memory_learnings_user_id_idx
  on public.marketing_memory_learnings (user_id);

alter table public.marketing_memory_learnings enable row level security;

-- select/insert/update (reconciliation updates a live row in place) -- no delete policy.
-- A learning is never deleted, only superseded, matching the audit-history rule already
-- established for every other Marketing Memory entity.
create policy "Users can view own marketing memory learnings"
  on public.marketing_memory_learnings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory learnings"
  on public.marketing_memory_learnings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing memory learnings"
  on public.marketing_memory_learnings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_marketing_memory_learnings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_memory_learnings_updated_at
  on public.marketing_memory_learnings;

create trigger marketing_memory_learnings_updated_at
  before update on public.marketing_memory_learnings
  for each row
  execute function public.set_marketing_memory_learnings_updated_at();

-- Extend marketing_memory_evidence_links (024) to support learning-anchored rows
-- alongside the existing observation-anchored rows. Every Phase 1 row already satisfies
-- the new "exactly one anchor" constraint (observation_id is not null, learning_id is
-- null by definition since the column is new).

alter table public.marketing_memory_evidence_links
  alter column observation_id drop not null;

alter table public.marketing_memory_evidence_links
  add column if not exists learning_id uuid references public.marketing_memory_learnings (id) on delete cascade;

alter table public.marketing_memory_evidence_links
  alter column link_type drop not null;

-- Null for observation-anchored (Phase 1) rows, where link_type already carries this
-- meaning; required for learning-anchored (Phase 2) rows.
alter table public.marketing_memory_evidence_links
  add column if not exists contribution text
    check (contribution is null or contribution in ('supporting', 'contradicting', 'neutral', 'excluded'));

alter table public.marketing_memory_evidence_links
  drop constraint if exists marketing_memory_evidence_links_source_type_check;

alter table public.marketing_memory_evidence_links
  add constraint marketing_memory_evidence_links_source_type_check
  check (
    source_type in (
      'recommendation',
      'recommendation_outcome_event',
      'content_approval',
      'publishing_job',
      'analytics_snapshot',
      'market_context_item',
      'monthly_focus',
      -- New in Phase 2: a learning citing a Phase 1 observation as its evidence.
      'observation'
    )
  );

alter table public.marketing_memory_evidence_links
  drop constraint if exists marketing_memory_evidence_links_exactly_one_anchor;

alter table public.marketing_memory_evidence_links
  add constraint marketing_memory_evidence_links_exactly_one_anchor
  check (
    (
      (observation_id is not null)::int
      + (learning_id is not null)::int
    ) = 1
  );

create index if not exists marketing_memory_evidence_links_learning_id_idx
  on public.marketing_memory_evidence_links (learning_id)
  where learning_id is not null;
