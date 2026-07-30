-- Business Learning Engine: reusable, persisted business patterns learned
-- from real recommendation outcomes, plus an explicit customer feedback
-- signal that reinforces or rejects a specific recommendation after the
-- fact. Mirrors the RLS/trigger shape of 025_marketing_memory_learnings.sql.
--
-- This is NOT a second Marketing Memory. lib/marketing-memory/ already
-- statistically evaluates recommendation_action_outcome / timing_performance
-- patterns from Phase 1 observations; this table stores broader Business
-- Brain patterns synthesized across multiple providers (Marketing Memory
-- learnings, recommendation outcomes, Business Knowledge Graph conclusions,
-- and this table's own feedback events) — see
-- docs/project-magic/BUSINESS_LEARNING_ENGINE.md for the full architecture.

create table if not exists public.business_learning_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  -- Deterministic: identifies "this same pattern" across reinforcements,
  -- independent of which specific row currently represents its live state.
  -- Mirrors marketing_memory_learnings.learning_key.
  pattern_key text not null,
  -- Customer-safe statement, e.g. "Educational blog posts generate better
  -- organic traffic than promotional posts." Never internal/raw language.
  statement text not null,
  direction text not null default 'neutral'
    check (direction in ('positive', 'negative', 'neutral', 'inconclusive')),
  confidence_level text not null default 'low'
    check (confidence_level in ('low', 'medium', 'high')),
  -- Opaque provider ids that have contributed evidence to this pattern —
  -- never branched on by the reinforcement engine itself (Part 10).
  contributing_providers text[] not null default '{}',
  -- Bounded evidence list — see lib/business-learning-engine/types.ts's
  -- PatternEvidence shape. Kept inline (not a second table) since evidence
  -- per pattern is small and always read/written together with the pattern.
  evidence jsonb not null default '[]'::jsonb,
  first_observed_at timestamptz not null default now(),
  last_reinforced_at timestamptz not null default now(),
  reinforcement_count integer not null default 1 check (reinforcement_count >= 1),
  -- Decay state, recomputed on read from last_reinforced_at — persisted only
  -- so it's queryable without recomputing every row. See
  -- lib/business-learning-engine/confidence.ts.
  decay_state text not null default 'fresh'
    check (decay_state in ('fresh', 'decaying', 'stale')),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one "live" (active) row per pattern_key per business — the same
-- "at most one active X" partial-unique-index pattern established by
-- marketing_memory_learnings_live_key_idx (025).
create unique index if not exists business_learning_patterns_live_key_idx
  on public.business_learning_patterns (business_profile_id, pattern_key)
  where status = 'active';

create index if not exists business_learning_patterns_business_id_idx
  on public.business_learning_patterns (business_profile_id);
create index if not exists business_learning_patterns_user_id_idx
  on public.business_learning_patterns (user_id);

alter table public.business_learning_patterns enable row level security;

create policy "Users can view own business learning patterns"
  on public.business_learning_patterns for select using (auth.uid() = user_id);
create policy "Users can insert own business learning patterns"
  on public.business_learning_patterns for insert with check (auth.uid() = user_id);
create policy "Users can update own business learning patterns"
  on public.business_learning_patterns for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_business_learning_patterns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_learning_patterns_updated_at
  on public.business_learning_patterns;

create trigger business_learning_patterns_updated_at
  before update on public.business_learning_patterns
  for each row
  execute function public.set_business_learning_patterns_updated_at();

-- Explicit customer feedback on a specific recommendation's real-world
-- value (Part 9) — distinct from content_approvals (approve/reject a
-- draft before publishing) and from recommendation_outcome_events'
-- do_more_like_this (a pre/at-approval-time signal). This is retrospective:
-- "did this actually help," feeding the Learning Engine directly.
create table if not exists public.recommendation_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  recommendation_id uuid not null references public.marketing_recommendations (id) on delete cascade,
  feedback text not null check (feedback in ('helped', 'not_useful')),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_feedback_events_recommendation_id_idx
  on public.recommendation_feedback_events (recommendation_id);
create index if not exists recommendation_feedback_events_business_id_idx
  on public.recommendation_feedback_events (business_profile_id);
create index if not exists recommendation_feedback_events_user_id_idx
  on public.recommendation_feedback_events (user_id);

alter table public.recommendation_feedback_events enable row level security;

-- Append-only, like recommendation_outcome_events — no update/delete policy.
create policy "Users can view own recommendation feedback events"
  on public.recommendation_feedback_events for select using (auth.uid() = user_id);
create policy "Users can insert own recommendation feedback events"
  on public.recommendation_feedback_events for insert with check (auth.uid() = user_id);
