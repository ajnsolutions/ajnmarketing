-- Market Context Agent: local/industry context signals and weekly briefs
create table if not exists public.market_context_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  category text not null check (
    category in (
      'weather',
      'holiday',
      'local_event',
      'school_calendar',
      'competitor',
      'news',
      'trend'
    )
  ),
  title text not null,
  summary text not null default '',
  source_name text,
  source_url text,
  relevance_score numeric(5, 2) not null default 0
    check (relevance_score >= 0 and relevance_score <= 100),
  confidence_score numeric(5, 2) not null default 0
    check (confidence_score >= 0 and confidence_score <= 100),
  context_date date not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_context_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  brief_start_date date not null,
  brief_end_date date not null,
  overall_summary text not null default '',
  recommended_topics jsonb not null default '[]'::jsonb,
  high_opportunity_keywords jsonb not null default '[]'::jsonb,
  content_angles jsonb not null default '[]'::jsonb,
  selected_context_item_ids jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('generating', 'active', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_context_items_user_id_idx
  on public.market_context_items (user_id);
create index if not exists market_context_items_business_profile_id_idx
  on public.market_context_items (business_profile_id);
create index if not exists market_context_items_category_idx
  on public.market_context_items (category);
create index if not exists market_context_items_context_date_idx
  on public.market_context_items (context_date desc);
create index if not exists market_context_items_relevance_score_idx
  on public.market_context_items (relevance_score desc);
create index if not exists market_context_items_created_at_idx
  on public.market_context_items (created_at desc);

create index if not exists market_context_briefs_user_id_idx
  on public.market_context_briefs (user_id);
create index if not exists market_context_briefs_business_profile_id_idx
  on public.market_context_briefs (business_profile_id);
create index if not exists market_context_briefs_status_idx
  on public.market_context_briefs (status);
create index if not exists market_context_briefs_brief_start_date_idx
  on public.market_context_briefs (brief_start_date desc);
create index if not exists market_context_briefs_created_at_idx
  on public.market_context_briefs (created_at desc);

alter table public.market_context_items enable row level security;
alter table public.market_context_briefs enable row level security;

create policy "Users can view own market context items"
  on public.market_context_items
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own market context items"
  on public.market_context_items
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own market context items"
  on public.market_context_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own market context items"
  on public.market_context_items
  for delete
  using (auth.uid() = user_id);

create policy "Users can view own market context briefs"
  on public.market_context_briefs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own market context briefs"
  on public.market_context_briefs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own market context briefs"
  on public.market_context_briefs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own market context briefs"
  on public.market_context_briefs
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_market_context_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_context_items_updated_at on public.market_context_items;

create trigger market_context_items_updated_at
  before update on public.market_context_items
  for each row
  execute function public.set_market_context_items_updated_at();

create or replace function public.set_market_context_briefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_context_briefs_updated_at on public.market_context_briefs;

create trigger market_context_briefs_updated_at
  before update on public.market_context_briefs
  for each row
  execute function public.set_market_context_briefs_updated_at();
