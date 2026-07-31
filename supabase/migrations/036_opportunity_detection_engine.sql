-- Opportunity Detection Engine: persisted, prioritized marketing
-- opportunities detected from real Business Brain evidence (Business
-- Discovery, Goals, Customer Voice, Website Testimonials, Search Console /
-- External Intelligence, Smart Uploads, the Business Knowledge Graph, the
-- Business Learning Engine). Mirrors the RLS/trigger shape of
-- 034_business_learning_engine.sql. Persisted only so an opportunity's
-- lifecycle (detected -> active -> completed/expired) can be tracked across
-- requests — never a private duplicate of what the Business Brain already
-- knows. See docs/project-magic/OPPORTUNITY_DETECTION_ENGINE.md.

create table if not exists public.detected_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  opportunity_type text not null check (opportunity_type in (
    'seasonal', 'trending_search', 'reputation', 'content_gap',
    'website_improvement', 'local_event', 'competitive_positioning',
    'customer_education', 'faq', 'service_spotlight', 'review_request',
    'underperforming_content_refresh', 'high_performing_content_expansion'
  )),
  -- Free-text topic used for merge/dedup by overlap (topicMatch.ts), not
  -- exact string equality — real text never normalizes identically.
  topic text not null,
  statement text not null,
  why_now text not null,
  expected_outcome text not null,
  -- Bounded evidence list — kept inline (not a second table) since evidence
  -- per opportunity is small and always read/written together with it.
  evidence jsonb not null default '[]'::jsonb,
  contributing_providers text[] not null default '{}',
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  score_total integer not null check (score_total between 0 and 100),
  score_evidence_strength integer not null check (score_evidence_strength between 0 and 100),
  score_business_impact integer not null check (score_business_impact between 0 and 100),
  score_urgency integer not null check (score_urgency between 0 and 100),
  score_confidence integer not null check (score_confidence between 0 and 100),
  score_historical_success integer not null check (score_historical_success between 0 and 100),
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  -- Opaque lib/marketing-decisions RecommendedActionType, when this
  -- opportunity's underlying action has one — lets the engine detect when
  -- the Business Learning Engine has observed real success/failure for it.
  related_action_type text,
  first_detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_reason text check (retired_reason in ('completed', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists detected_opportunities_business_id_idx
  on public.detected_opportunities (business_profile_id);
create index if not exists detected_opportunities_user_id_idx
  on public.detected_opportunities (user_id);
create index if not exists detected_opportunities_status_idx
  on public.detected_opportunities (status);
create index if not exists detected_opportunities_score_idx
  on public.detected_opportunities (score_total desc);

alter table public.detected_opportunities enable row level security;

create policy "Users can view own detected opportunities"
  on public.detected_opportunities for select using (auth.uid() = user_id);
create policy "Users can insert own detected opportunities"
  on public.detected_opportunities for insert with check (auth.uid() = user_id);
create policy "Users can update own detected opportunities"
  on public.detected_opportunities for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_detected_opportunities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists detected_opportunities_updated_at on public.detected_opportunities;

create trigger detected_opportunities_updated_at
  before update on public.detected_opportunities
  for each row
  execute function public.set_detected_opportunities_updated_at();
