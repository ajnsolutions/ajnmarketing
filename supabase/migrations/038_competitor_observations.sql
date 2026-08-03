-- Competitor Observation Engine: evidence + confidence records scoring the
-- existing lib/market-context/providers/competitorProvider.ts signal against
-- an owner's tracked Market Radar competitors (public.market_radar_entries,
-- 037_market_radar.sql). One row is one "meaningful observation" that
-- cleared lib/competitor-observations/scoring.ts's bar — not a raw provider
-- payload. This is not live competitor monitoring: source_label always
-- traces back to a real, already-existing signal source, per
-- docs/project-magic/MARKET_RADAR.md's "no fabricated competitive claims"
-- rule. Mirrors the RLS/trigger shape of 037_market_radar.sql.

create table if not exists public.competitor_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  market_radar_entry_id uuid not null references public.market_radar_entries (id) on delete cascade,
  summary text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source_label text not null,
  -- Not every signal has a specific event time (e.g. profile-declared data).
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists competitor_observations_business_profile_id_idx
  on public.competitor_observations (business_profile_id);
create index if not exists competitor_observations_user_id_idx
  on public.competitor_observations (user_id);
create index if not exists competitor_observations_market_radar_entry_id_idx
  on public.competitor_observations (market_radar_entry_id);

alter table public.competitor_observations enable row level security;

create policy "Users can view own competitor observations"
  on public.competitor_observations for select using (auth.uid() = user_id);
create policy "Users can insert own competitor observations"
  on public.competitor_observations for insert with check (auth.uid() = user_id);
create policy "Users can update own competitor observations"
  on public.competitor_observations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own competitor observations"
  on public.competitor_observations for delete using (auth.uid() = user_id);

create or replace function public.set_competitor_observations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists competitor_observations_updated_at on public.competitor_observations;

create trigger competitor_observations_updated_at
  before update on public.competitor_observations
  for each row
  execute function public.set_competitor_observations_updated_at();
