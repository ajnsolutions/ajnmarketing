-- Campaign Intelligence Engine (Project Magic Phase 2B).
-- See docs/CAMPAIGN_INTELLIGENCE_ENGINE.md.
--
-- Campaigns are execution plans initiated only via Marketing Director–gated APIs.
-- They never create recommendations. Steps reference existing recommended_action_type
-- values only. Completion records Marketing Memory observations (evidence only).

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  campaign_type text not null check (
    campaign_type in (
      'back_to_school',
      'holiday_promotion',
      'customer_appreciation',
      'community_event',
      'hiring',
      'seasonal_promotion'
    )
  ),
  objective text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'planned',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'measured',
      'archived'
      -- 'cancelled' reserved for a future phase — not granted in this check yet
    )
  ),
  start_date date null,
  target_end_date date null,
  current_step_index integer not null default 0 check (current_step_index >= 0),
  -- Declarative timeline snapshot: [{ key, label, actionType, status, scheduledFor, completedAt }]
  timeline jsonb not null default '[]'::jsonb,
  -- Deterministic metrics object — never AI scores
  metrics jsonb not null default '{}'::jsonb,
  created_from_recommendation_id uuid null
    references public.marketing_recommendations (id) on delete set null,
  -- Marketing Director decisions are not yet persisted as rows; store a stable
  -- provenance key (e.g. evaluatedAt + decisionType) for audit, not a FK.
  marketing_director_decision_key text null,
  template_id text not null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_business_status_idx
  on public.marketing_campaigns (business_profile_id, status);
create index if not exists marketing_campaigns_business_created_idx
  on public.marketing_campaigns (business_profile_id, created_at desc);
create index if not exists marketing_campaigns_user_id_idx
  on public.marketing_campaigns (user_id);

alter table public.marketing_campaigns enable row level security;

create policy "Users can view own marketing campaigns"
  on public.marketing_campaigns
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing campaigns"
  on public.marketing_campaigns
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing campaigns"
  on public.marketing_campaigns
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_marketing_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_campaigns_updated_at on public.marketing_campaigns;

create trigger marketing_campaigns_updated_at
  before update on public.marketing_campaigns
  for each row
  execute function public.set_marketing_campaigns_updated_at();

-- Extend Marketing Memory observations so campaign completion is first-class evidence
-- (never a Learning write). Additive only — every Phase 1/2/3 row remains valid.

alter table public.marketing_memory_observations
  add column if not exists source_campaign_id uuid
    references public.marketing_campaigns (id) on delete set null;

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
      'campaign_completed'
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
      'campaign-intelligence'
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
    ) = 1
  );

create index if not exists marketing_memory_observations_source_campaign_idx
  on public.marketing_memory_observations (source_campaign_id)
  where source_campaign_id is not null;

-- Allow evidence links to cite a campaign as a related/primary source entity.
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
      'campaign'
    )
  );
