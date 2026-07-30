-- Website Testimonials: the second Customer Voice provider
-- (CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS, already reserved in
-- lib/customer-voice/types.ts). Mirrors the RLS/trigger shape of
-- 033_smart_uploads.sql — a raw record table plus a normalized,
-- AI-extracted knowledge-fact table, never a private duplicate of what the
-- Business Brain already knows.

create table if not exists public.website_testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  author_name text,
  author_title text,
  quote text not null,
  source_url text,
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  occurred_at timestamptz,
  ingestion_method text not null check (
    ingestion_method in ('manual', 'website_import', 'bulk_paste', 'csv_import')
  ),
  status text not null default 'active' check (status in ('active', 'archived')),
  fact_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_testimonials_user_id_idx on public.website_testimonials (user_id);
create index if not exists website_testimonials_business_profile_id_idx
  on public.website_testimonials (business_profile_id);
create index if not exists website_testimonials_status_idx on public.website_testimonials (status);
create index if not exists website_testimonials_created_at_idx
  on public.website_testimonials (created_at desc);

alter table public.website_testimonials enable row level security;

create policy "Users can view own website testimonials"
  on public.website_testimonials for select using (auth.uid() = user_id);
create policy "Users can insert own website testimonials"
  on public.website_testimonials for insert with check (auth.uid() = user_id);
create policy "Users can update own website testimonials"
  on public.website_testimonials for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own website testimonials"
  on public.website_testimonials for delete using (auth.uid() = user_id);

create or replace function public.set_website_testimonials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists website_testimonials_updated_at on public.website_testimonials;

create trigger website_testimonials_updated_at
  before update on public.website_testimonials
  for each row
  execute function public.set_website_testimonials_updated_at();

-- Normalized, reusable business knowledge extracted from testimonial text —
-- distinct from Customer Voice's own deterministic theme extraction
-- (lib/customer-voice/themes.ts), which still runs on every testimonial via
-- the provider abstraction. This table is the AI-extracted layer Part 2
-- asks for: customer benefits, business strengths, recurring outcomes,
-- objections overcome, industry terminology, emotional language, trust
-- indicators, differentiators, customer segments.
create table if not exists public.testimonial_knowledge_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  testimonial_id uuid not null references public.website_testimonials (id) on delete cascade,
  category text not null check (category in (
    'customer_benefit', 'business_strength', 'recurring_outcome',
    'objection_overcome', 'industry_terminology', 'emotional_language',
    'trust_indicator', 'differentiator', 'customer_segment'
  )),
  fact text not null,
  source_excerpt text,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testimonial_knowledge_facts_user_id_idx
  on public.testimonial_knowledge_facts (user_id);
create index if not exists testimonial_knowledge_facts_business_profile_id_idx
  on public.testimonial_knowledge_facts (business_profile_id);
create index if not exists testimonial_knowledge_facts_testimonial_id_idx
  on public.testimonial_knowledge_facts (testimonial_id);
create index if not exists testimonial_knowledge_facts_category_idx
  on public.testimonial_knowledge_facts (category);

alter table public.testimonial_knowledge_facts enable row level security;

create policy "Users can view own testimonial knowledge facts"
  on public.testimonial_knowledge_facts for select using (auth.uid() = user_id);
create policy "Users can insert own testimonial knowledge facts"
  on public.testimonial_knowledge_facts for insert with check (auth.uid() = user_id);
create policy "Users can update own testimonial knowledge facts"
  on public.testimonial_knowledge_facts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own testimonial knowledge facts"
  on public.testimonial_knowledge_facts for delete using (auth.uid() = user_id);

create or replace function public.set_testimonial_knowledge_facts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists testimonial_knowledge_facts_updated_at on public.testimonial_knowledge_facts;

create trigger testimonial_knowledge_facts_updated_at
  before update on public.testimonial_knowledge_facts
  for each row
  execute function public.set_testimonial_knowledge_facts_updated_at();
