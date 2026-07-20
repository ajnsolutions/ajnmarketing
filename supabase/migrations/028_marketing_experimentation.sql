-- Marketing Experimentation Engine (Project Magic Phase 2E).
-- See docs/MARKETING_EXPERIMENTATION_ENGINE.md.
--
-- Experiments measure outcomes for Marketing Director–proposed, user-approved tests.
-- They never invent strategy, recommendations, or autonomous publishes.
-- Completion records Marketing Memory observations (evidence only).

create table if not exists public.marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  experiment_type text not null check (
    experiment_type in (
      'posting_time',
      'content_format',
      'cta_variation',
      'messaging_style',
      'image_vs_text',
      'campaign_sequencing',
      'review_request_timing'
    )
  ),
  title text not null,
  hypothesis text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'proposed',
      'approved',
      'running',
      'measuring',
      'completed',
      'archived'
    )
  ),
  -- Declarative variants: [{ key, label, description }]
  variants jsonb not null default '[]'::jsonb,
  -- Deterministic outcome summary — never AI/ML scores
  outcome jsonb not null default '{}'::jsonb,
  -- Measured KPI snapshot used for comparison (existing analytics only)
  metrics jsonb not null default '{}'::jsonb,
  created_from_recommendation_id uuid not null
    references public.marketing_recommendations (id) on delete restrict,
  related_campaign_id uuid null
    references public.marketing_campaigns (id) on delete set null,
  -- Marketing Director decisions are not persisted as rows; store provenance key.
  marketing_director_decision_key text not null,
  template_id text not null,
  started_at timestamptz null,
  measured_at timestamptz null,
  completed_at timestamptz null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_experiments_business_status_idx
  on public.marketing_experiments (business_profile_id, status);
create index if not exists marketing_experiments_business_created_idx
  on public.marketing_experiments (business_profile_id, created_at desc);
create index if not exists marketing_experiments_user_id_idx
  on public.marketing_experiments (user_id);
create index if not exists marketing_experiments_recommendation_idx
  on public.marketing_experiments (created_from_recommendation_id);

alter table public.marketing_experiments enable row level security;

create policy "Users can view own marketing experiments"
  on public.marketing_experiments
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing experiments"
  on public.marketing_experiments
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing experiments"
  on public.marketing_experiments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_marketing_experiments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_experiments_updated_at on public.marketing_experiments;

create trigger marketing_experiments_updated_at
  before update on public.marketing_experiments
  for each row
  execute function public.set_marketing_experiments_updated_at();

-- Extend Marketing Memory observations for experiment completion evidence.

alter table public.marketing_memory_observations
  add column if not exists source_experiment_id uuid
    references public.marketing_experiments (id) on delete set null;

alter table public.marketing_memory_observations
  drop constraint if exists marketing_memory_observations_observation_type_check;

alter table public.marketing_memory_observations
  add constraint marketing_memory_observations_observation_type_check
  check (
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
      'analytics_snapshot_captured',
      'campaign_completed',
      'experiment_completed'
    )
  );

alter table public.marketing_memory_observations
  drop constraint if exists marketing_memory_observations_source_system_check;

alter table public.marketing_memory_observations
  add constraint marketing_memory_observations_source_system_check
  check (
    source_system in (
      'recommendation-outcomes',
      'analytics',
      'campaign-intelligence',
      'marketing-experimentation'
    )
  );

alter table public.marketing_memory_observations
  drop constraint if exists marketing_memory_observations_exactly_one_primary_source;

alter table public.marketing_memory_observations
  add constraint marketing_memory_observations_exactly_one_primary_source
  check (
    (
      (source_outcome_event_id is not null)::int
      + (source_analytics_snapshot_id is not null)::int
      + (source_campaign_id is not null)::int
      + (source_experiment_id is not null)::int
    ) = 1
  );

create index if not exists marketing_memory_observations_source_experiment_idx
  on public.marketing_memory_observations (source_experiment_id)
  where source_experiment_id is not null;

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
      'observation',
      'override',
      'campaign',
      'experiment'
    )
  );
