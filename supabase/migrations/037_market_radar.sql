-- Market Radar: owner-managed persistence foundation. Lets an owner track
-- named competitors (add/remove/prioritize) and aspirational benchmark
-- businesses, per docs/project-magic/MARKET_RADAR.md's "Owner control"
-- section. This is a new, separate module alongside the existing
-- lib/market-context/ competitor signal pipeline (EXISTING_SYSTEM_AUDIT.md
-- classifies owner-facing competitor control and benchmark tracking as
-- Needs Expansion / New Functionality) — it does not modify or feed that
-- pipeline. Mirrors the RLS/trigger shape of 035_website_testimonials.sql;
-- unlike 036_opportunity_detection_engine.sql's detected_opportunities
-- (a system-lifecycle record that retires rather than deletes), an owner's
-- tracked entry here is genuinely theirs to delete.

create table if not exists public.market_radar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  kind text not null check (kind in ('competitor', 'benchmark')),
  name text not null,
  -- Meaningful only for kind = 'competitor'; left null for benchmarks.
  priority integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_radar_entries_business_profile_id_idx
  on public.market_radar_entries (business_profile_id);
create index if not exists market_radar_entries_user_id_idx
  on public.market_radar_entries (user_id);

alter table public.market_radar_entries enable row level security;

create policy "Users can view own market radar entries"
  on public.market_radar_entries for select using (auth.uid() = user_id);
create policy "Users can insert own market radar entries"
  on public.market_radar_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own market radar entries"
  on public.market_radar_entries for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own market radar entries"
  on public.market_radar_entries for delete using (auth.uid() = user_id);

create or replace function public.set_market_radar_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_radar_entries_updated_at on public.market_radar_entries;

create trigger market_radar_entries_updated_at
  before update on public.market_radar_entries
  for each row
  execute function public.set_market_radar_entries_updated_at();
