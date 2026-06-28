-- Website analysis: AI knowledge base extracted from customer websites
create table if not exists public.website_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  website text not null,
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'running', 'completed', 'failed')),
  analysis_score integer,
  brand_voice text,
  tone text,
  keywords jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  cities jsonb not null default '[]'::jsonb,
  seo_score integer,
  seo_findings jsonb not null default '[]'::jsonb,
  raw_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_analysis_user_id_key unique (user_id)
);

create index if not exists website_analysis_user_id_idx on public.website_analysis (user_id);
create index if not exists website_analysis_business_profile_id_idx on public.website_analysis (business_profile_id);

alter table public.website_analysis enable row level security;

create policy "Users can view own website analysis"
  on public.website_analysis
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own website analysis"
  on public.website_analysis
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own website analysis"
  on public.website_analysis
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_website_analysis_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists website_analysis_updated_at on public.website_analysis;

create trigger website_analysis_updated_at
  before update on public.website_analysis
  for each row
  execute function public.set_website_analysis_updated_at();
