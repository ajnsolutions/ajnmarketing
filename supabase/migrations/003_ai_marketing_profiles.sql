-- AI Marketing Profile: centralized strategy and knowledge base per customer
create table if not exists public.ai_marketing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  website_analysis_id uuid references public.website_analysis (id) on delete set null,
  profile_status text not null default 'pending'
    check (profile_status in ('pending', 'generating', 'active', 'failed')),
  business_summary text,
  target_audience text,
  ideal_customer text,
  services jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  industry text,
  brand_voice text,
  tone text,
  value_proposition text,
  keywords jsonb not null default '[]'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  seasonal_opportunities jsonb not null default '[]'::jsonb,
  recommended_ctas jsonb not null default '[]'::jsonb,
  common_objections jsonb not null default '[]'::jsonb,
  brand_personality jsonb not null default '[]'::jsonb,
  writing_examples jsonb not null default '[]'::jsonb,
  marketing_strategy text,
  seo_strategy text,
  content_strategy text,
  review_strategy text,
  google_business_strategy text,
  monthly_themes jsonb not null default '[]'::jsonb,
  quarterly_campaigns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_marketing_profiles_user_id_key unique (user_id)
);

create index if not exists ai_marketing_profiles_user_id_idx on public.ai_marketing_profiles (user_id);
create index if not exists ai_marketing_profiles_business_profile_id_idx
  on public.ai_marketing_profiles (business_profile_id);
create index if not exists ai_marketing_profiles_website_analysis_id_idx
  on public.ai_marketing_profiles (website_analysis_id);

alter table public.ai_marketing_profiles enable row level security;

create policy "Users can view own AI marketing profile"
  on public.ai_marketing_profiles
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own AI marketing profile"
  on public.ai_marketing_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own AI marketing profile"
  on public.ai_marketing_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_ai_marketing_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_marketing_profiles_updated_at on public.ai_marketing_profiles;

create trigger ai_marketing_profiles_updated_at
  before update on public.ai_marketing_profiles
  for each row
  execute function public.set_ai_marketing_profiles_updated_at();
