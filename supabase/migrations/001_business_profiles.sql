-- Business profiles: master customer record for AJN Marketing
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_name text,
  industry text,
  website text,
  phone text,
  city text,
  state text,
  primary_service_area text,
  nearby_cities text,
  primary_services text,
  emergency_services text,
  seasonal_services text,
  specialty_services text,
  competitors text,
  marketing_goals text[] default '{}',
  brand_voice_tone text,
  preferred_words text,
  avoid_words text,
  voice_notes text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_user_id_key unique (user_id)
);

create index if not exists business_profiles_user_id_idx on public.business_profiles (user_id);

alter table public.business_profiles enable row level security;

create policy "Users can view own business profile"
  on public.business_profiles
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own business profile"
  on public.business_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own business profile"
  on public.business_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_business_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_profiles_updated_at on public.business_profiles;

create trigger business_profiles_updated_at
  before update on public.business_profiles
  for each row
  execute function public.set_business_profiles_updated_at();
