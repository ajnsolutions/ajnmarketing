-- Analytics Feedback Loop: snapshots, content performance, AI recommendations
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  snapshot_date date not null,
  google_views integer not null default 0,
  searches integer not null default 0,
  calls integer not null default 0,
  direction_requests integer not null default 0,
  website_clicks integer not null default 0,
  review_count integer not null default 0,
  average_rating numeric(3, 2),
  posts_published integer not null default 0,
  engagement_score numeric(5, 2) not null default 0
    check (engagement_score >= 0 and engagement_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.content_performance (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.publishing_queue (id) on delete cascade,
  publishing_job_id uuid references public.publishing_jobs (id) on delete set null,
  provider text not null
    check (provider in ('google_business_profile', 'facebook', 'instagram', 'linkedin', 'email')),
  published_at timestamptz,
  views integer not null default 0,
  clicks integer not null default 0,
  engagement integer not null default 0,
  conversions integer not null default 0,
  performance_score numeric(5, 2) not null default 0
    check (performance_score >= 0 and performance_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  category text not null
    check (category in (
      'posting',
      'reviews',
      'visibility',
      'content',
      'competitors',
      'seasonality',
      'engagement'
    )),
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  title text not null,
  description text not null,
  reason text not null default '',
  confidence numeric(5, 2) not null default 0
    check (confidence >= 0 and confidence <= 100),
  status text not null default 'active'
    check (status in ('active', 'applied', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists analytics_snapshots_user_date_idx
  on public.analytics_snapshots (user_id, snapshot_date);
create index if not exists analytics_snapshots_user_id_idx
  on public.analytics_snapshots (user_id);
create index if not exists analytics_snapshots_business_profile_id_idx
  on public.analytics_snapshots (business_profile_id);
create index if not exists analytics_snapshots_created_at_idx
  on public.analytics_snapshots (created_at desc);

create index if not exists content_performance_content_id_idx
  on public.content_performance (content_id);
create index if not exists content_performance_publishing_job_id_idx
  on public.content_performance (publishing_job_id);
create index if not exists content_performance_provider_idx
  on public.content_performance (provider);
create index if not exists content_performance_performance_score_idx
  on public.content_performance (performance_score desc);
create index if not exists content_performance_created_at_idx
  on public.content_performance (created_at desc);

create index if not exists ai_recommendations_user_id_idx
  on public.ai_recommendations (user_id);
create index if not exists ai_recommendations_business_profile_id_idx
  on public.ai_recommendations (business_profile_id);
create index if not exists ai_recommendations_status_idx
  on public.ai_recommendations (status);
create index if not exists ai_recommendations_category_idx
  on public.ai_recommendations (category);
create index if not exists ai_recommendations_created_at_idx
  on public.ai_recommendations (created_at desc);

alter table public.analytics_snapshots enable row level security;
alter table public.content_performance enable row level security;
alter table public.ai_recommendations enable row level security;

create policy "Users can view own analytics snapshots"
  on public.analytics_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert own analytics snapshots"
  on public.analytics_snapshots for insert with check (auth.uid() = user_id);
create policy "Users can update own analytics snapshots"
  on public.analytics_snapshots for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own analytics snapshots"
  on public.analytics_snapshots for delete using (auth.uid() = user_id);

create policy "Users can view own content performance"
  on public.content_performance for select
  using (
    exists (
      select 1 from public.publishing_queue pq
      where pq.id = content_performance.content_id and pq.user_id = auth.uid()
    )
  );
create policy "Users can insert own content performance"
  on public.content_performance for insert
  with check (
    exists (
      select 1 from public.publishing_queue pq
      where pq.id = content_performance.content_id and pq.user_id = auth.uid()
    )
  );
create policy "Users can update own content performance"
  on public.content_performance for update
  using (
    exists (
      select 1 from public.publishing_queue pq
      where pq.id = content_performance.content_id and pq.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.publishing_queue pq
      where pq.id = content_performance.content_id and pq.user_id = auth.uid()
    )
  );
create policy "Users can delete own content performance"
  on public.content_performance for delete
  using (
    exists (
      select 1 from public.publishing_queue pq
      where pq.id = content_performance.content_id and pq.user_id = auth.uid()
    )
  );

create policy "Users can view own ai recommendations"
  on public.ai_recommendations for select using (auth.uid() = user_id);
create policy "Users can insert own ai recommendations"
  on public.ai_recommendations for insert with check (auth.uid() = user_id);
create policy "Users can update own ai recommendations"
  on public.ai_recommendations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own ai recommendations"
  on public.ai_recommendations for delete using (auth.uid() = user_id);
