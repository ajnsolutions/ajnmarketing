-- Google Business Profile sync: locations, posts, reviews, insights, sync log

create table if not exists public.google_business_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  connection_id uuid not null references public.google_business_profile_connections (id) on delete cascade,
  google_location_id text not null,
  google_account_id text not null,
  location_title text,
  primary_category text,
  phone text,
  website_uri text,
  address_json jsonb not null default '{}'::jsonb,
  profile_metadata jsonb not null default '{}'::jsonb,
  average_rating numeric(3, 2),
  review_count integer not null default 0,
  verification_status text,
  is_primary boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_location_id)
);

create index if not exists google_business_locations_user_id_idx on public.google_business_locations (user_id);
create index if not exists google_business_locations_business_profile_id_idx
  on public.google_business_locations (business_profile_id);
create index if not exists google_business_locations_google_location_id_idx
  on public.google_business_locations (google_location_id);
create index if not exists google_business_locations_created_at_idx
  on public.google_business_locations (created_at desc);

create table if not exists public.google_business_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  location_id uuid references public.google_business_locations (id) on delete set null,
  google_post_id text,
  post_type text not null default 'standard',
  status text not null default 'published'
    check (status in ('published', 'scheduled', 'draft', 'expired', 'rejected')),
  title text,
  summary text,
  call_to_action text,
  media_json jsonb not null default '[]'::jsonb,
  publish_time timestamptz,
  scheduled_time timestamptz,
  source text not null default 'google'
    check (source in ('google', 'local')),
  publishing_queue_id uuid references public.publishing_queue (id) on delete set null,
  content_approval_id uuid references public.content_approvals (id) on delete set null,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_business_posts_google_post_id_idx
  on public.google_business_posts (user_id, google_post_id)
  where google_post_id is not null;

create index if not exists google_business_posts_user_id_idx on public.google_business_posts (user_id);
create index if not exists google_business_posts_business_profile_id_idx
  on public.google_business_posts (business_profile_id);
create index if not exists google_business_posts_location_id_idx on public.google_business_posts (location_id);
create index if not exists google_business_posts_status_idx on public.google_business_posts (status);
create index if not exists google_business_posts_created_at_idx
  on public.google_business_posts (created_at desc);

create table if not exists public.google_business_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  location_id uuid references public.google_business_locations (id) on delete set null,
  google_review_id text not null,
  reviewer_name text,
  reviewer_photo_url text,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  review_reply text,
  reply_status text not null default 'unanswered'
    check (reply_status in ('unanswered', 'draft', 'responded', 'marked_responded')),
  ai_draft_reply text,
  google_review_url text,
  review_created_at timestamptz,
  reply_updated_at timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_review_id)
);

create index if not exists google_business_reviews_user_id_idx on public.google_business_reviews (user_id);
create index if not exists google_business_reviews_business_profile_id_idx
  on public.google_business_reviews (business_profile_id);
create index if not exists google_business_reviews_location_id_idx on public.google_business_reviews (location_id);
create index if not exists google_business_reviews_reply_status_idx on public.google_business_reviews (reply_status);
create index if not exists google_business_reviews_created_at_idx
  on public.google_business_reviews (created_at desc);
create index if not exists google_business_reviews_review_created_at_idx
  on public.google_business_reviews (review_created_at desc);

create table if not exists public.google_business_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  location_id uuid not null references public.google_business_locations (id) on delete cascade,
  metric_date date not null,
  period_month text not null,
  search_views integer not null default 0,
  maps_views integer not null default 0,
  website_clicks integer not null default 0,
  phone_calls integer not null default 0,
  direction_requests integer not null default 0,
  raw_metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, metric_date)
);

create index if not exists google_business_insights_user_id_idx on public.google_business_insights (user_id);
create index if not exists google_business_insights_business_profile_id_idx
  on public.google_business_insights (business_profile_id);
create index if not exists google_business_insights_location_id_idx on public.google_business_insights (location_id);
create index if not exists google_business_insights_period_month_idx on public.google_business_insights (period_month);
create index if not exists google_business_insights_created_at_idx
  on public.google_business_insights (created_at desc);

create table if not exists public.google_business_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  connection_id uuid references public.google_business_profile_connections (id) on delete set null,
  sync_status text not null default 'running'
    check (sync_status in ('running', 'success', 'partial', 'failed')),
  locations_synced integer not null default 0,
  reviews_synced integer not null default 0,
  posts_synced integer not null default 0,
  insights_synced integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_business_sync_log_user_id_idx on public.google_business_sync_log (user_id);
create index if not exists google_business_sync_log_business_profile_id_idx
  on public.google_business_sync_log (business_profile_id);
create index if not exists google_business_sync_log_sync_status_idx
  on public.google_business_sync_log (sync_status);
create index if not exists google_business_sync_log_created_at_idx
  on public.google_business_sync_log (created_at desc);
create index if not exists google_business_sync_log_started_at_idx
  on public.google_business_sync_log (started_at desc);

alter table public.google_business_locations enable row level security;
alter table public.google_business_posts enable row level security;
alter table public.google_business_reviews enable row level security;
alter table public.google_business_insights enable row level security;
alter table public.google_business_sync_log enable row level security;

create policy "Users can view own google business locations"
  on public.google_business_locations for select using (auth.uid() = user_id);
create policy "Users can insert own google business locations"
  on public.google_business_locations for insert with check (auth.uid() = user_id);
create policy "Users can update own google business locations"
  on public.google_business_locations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own google business posts"
  on public.google_business_posts for select using (auth.uid() = user_id);
create policy "Users can insert own google business posts"
  on public.google_business_posts for insert with check (auth.uid() = user_id);
create policy "Users can update own google business posts"
  on public.google_business_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own google business reviews"
  on public.google_business_reviews for select using (auth.uid() = user_id);
create policy "Users can insert own google business reviews"
  on public.google_business_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own google business reviews"
  on public.google_business_reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own google business insights"
  on public.google_business_insights for select using (auth.uid() = user_id);
create policy "Users can insert own google business insights"
  on public.google_business_insights for insert with check (auth.uid() = user_id);
create policy "Users can update own google business insights"
  on public.google_business_insights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own google business sync log"
  on public.google_business_sync_log for select using (auth.uid() = user_id);
create policy "Users can insert own google business sync log"
  on public.google_business_sync_log for insert with check (auth.uid() = user_id);
create policy "Users can update own google business sync log"
  on public.google_business_sync_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_google_business_locations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.set_google_business_posts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.set_google_business_reviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.set_google_business_insights_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists google_business_locations_updated_at on public.google_business_locations;
create trigger google_business_locations_updated_at before update on public.google_business_locations
  for each row execute function public.set_google_business_locations_updated_at();
drop trigger if exists google_business_posts_updated_at on public.google_business_posts;
create trigger google_business_posts_updated_at before update on public.google_business_posts
  for each row execute function public.set_google_business_posts_updated_at();
drop trigger if exists google_business_reviews_updated_at on public.google_business_reviews;
create trigger google_business_reviews_updated_at before update on public.google_business_reviews
  for each row execute function public.set_google_business_reviews_updated_at();
drop trigger if exists google_business_insights_updated_at on public.google_business_insights;
create trigger google_business_insights_updated_at before update on public.google_business_insights
  for each row execute function public.set_google_business_insights_updated_at();
