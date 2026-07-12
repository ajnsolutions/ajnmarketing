-- Marketing Decision Engine: Phase 2A.2 of the Autonomous Marketing Agent.
-- Each row is one prioritized recommendation, derived from one or more active
-- marketing_opportunities rows by lib/marketing-decisions/decisionEngine.ts. A
-- recommendation can represent a single opportunity or a merged group of related ones
-- (see related_opportunity_ids) — merging happens when several open opportunities map
-- to the same recommended_action_type (e.g. an upcoming holiday, a weather signal, and
-- a local event all suggest the same underlying action: create timely content now).
create table if not exists public.marketing_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  recommended_action_type text not null check (
    recommended_action_type in (
      'publish_gbp_post',
      'request_reviews',
      'create_seasonal_content',
      'create_timely_content',
      'increase_posting_frequency',
      'update_business_info',
      'upload_photos',
      'refresh_website_content'
    )
  ),
  priority_score numeric(6, 2) not null default 0
    check (priority_score >= 0 and priority_score <= 100),
  urgency text not null check (urgency in ('low', 'medium', 'high', 'critical')),
  business_impact text not null check (business_impact in ('low', 'medium', 'high')),
  estimated_effort text not null check (estimated_effort in ('low', 'medium', 'high')),
  confidence numeric(5, 2) not null default 0
    check (confidence >= 0 and confidence <= 100),
  reasoning text not null default '',
  related_opportunity_ids uuid[] not null default '{}',
  -- Idempotency identity: the sorted related_opportunity_ids, joined. The same set of
  -- underlying opportunities always regroups into the same dedupe_key, so the
  -- persistence layer's upsert updates the existing row instead of duplicating it.
  dedupe_key text not null default '',
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'completed', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_recommendations_dedupe_key
    unique (user_id, business_profile_id, dedupe_key)
);

create index if not exists marketing_recommendations_user_id_idx
  on public.marketing_recommendations (user_id);
create index if not exists marketing_recommendations_business_profile_id_idx
  on public.marketing_recommendations (business_profile_id);
create index if not exists marketing_recommendations_status_idx
  on public.marketing_recommendations (status);
create index if not exists marketing_recommendations_created_at_idx
  on public.marketing_recommendations (created_at desc);
-- Backs "open recommendations for this business, highest priority first".
create index if not exists marketing_recommendations_open_by_priority_idx
  on public.marketing_recommendations (business_profile_id, status, priority_score desc);
-- Backs "which recommendation(s) reference opportunity X" (array-containment lookups).
create index if not exists marketing_recommendations_related_opportunity_ids_idx
  on public.marketing_recommendations using gin (related_opportunity_ids);

alter table public.marketing_recommendations enable row level security;

create policy "Users can view own marketing recommendations"
  on public.marketing_recommendations
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing recommendations"
  on public.marketing_recommendations
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing recommendations"
  on public.marketing_recommendations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own marketing recommendations"
  on public.marketing_recommendations
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_marketing_recommendations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_recommendations_updated_at on public.marketing_recommendations;

create trigger marketing_recommendations_updated_at
  before update on public.marketing_recommendations
  for each row
  execute function public.set_marketing_recommendations_updated_at();
