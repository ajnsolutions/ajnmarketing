-- Marketing Opportunity Detection Engine: Phase 2A.1 of the Autonomous Marketing Agent.
-- Each row is one detected opportunity for one business, produced by a detector in
-- lib/marketing-opportunities/detectors/*. Detectors are idempotent by design: the
-- (user_id, business_profile_id, category, dedupe_key) unique constraint below is what
-- the persistence layer upserts against, so re-running detection updates an existing
-- opportunity's evidence/confidence/expiry instead of creating a duplicate row.
create table if not exists public.marketing_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  category text not null check (
    category in (
      'missing_gbp_posts',
      'low_review_activity',
      'seasonal',
      'holiday',
      'weather',
      'local_event',
      'declining_engagement',
      'missing_business_info',
      'missing_photos',
      'stale_website_content'
    )
  ),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric(5, 2) not null default 0
    check (confidence >= 0 and confidence <= 100),
  title text not null,
  description text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  recommended_action text not null default '',
  -- Detector-supplied stable identity for one logical opportunity within its category
  -- (e.g. a specific holiday's item id, a season+year, or a constant for
  -- "only one of these makes sense at a time" categories like missing_business_info).
  -- Combined with (user_id, business_profile_id, category) below for the idempotency
  -- upsert key.
  dedupe_key text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'dismissed', 'expired', 'resolved')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_opportunities_dedupe_key
    unique (user_id, business_profile_id, category, dedupe_key)
);

create index if not exists marketing_opportunities_user_id_idx
  on public.marketing_opportunities (user_id);
create index if not exists marketing_opportunities_business_profile_id_idx
  on public.marketing_opportunities (business_profile_id);
create index if not exists marketing_opportunities_category_idx
  on public.marketing_opportunities (category);
create index if not exists marketing_opportunities_status_idx
  on public.marketing_opportunities (status);
create index if not exists marketing_opportunities_expires_at_idx
  on public.marketing_opportunities (expires_at)
  where expires_at is not null;
create index if not exists marketing_opportunities_created_at_idx
  on public.marketing_opportunities (created_at desc);
-- Backs the common "open opportunities for this business, most severe/recent first" query.
create index if not exists marketing_opportunities_open_by_business_idx
  on public.marketing_opportunities (business_profile_id, status, created_at desc);

alter table public.marketing_opportunities enable row level security;

create policy "Users can view own marketing opportunities"
  on public.marketing_opportunities
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing opportunities"
  on public.marketing_opportunities
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing opportunities"
  on public.marketing_opportunities
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own marketing opportunities"
  on public.marketing_opportunities
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_marketing_opportunities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_opportunities_updated_at on public.marketing_opportunities;

create trigger marketing_opportunities_updated_at
  before update on public.marketing_opportunities
  for each row
  execute function public.set_marketing_opportunities_updated_at();
