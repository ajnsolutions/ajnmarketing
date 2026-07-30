-- Google Search Console: OAuth connections, discovered properties, normalized
-- query/page performance snapshots, and sync log. Mirrors the shape of
-- 006_google_business_profile_connections.sql / 009_google_business_sync.sql.

create table if not exists public.google_search_console_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  google_account_email text,
  google_account_name text,
  google_account_id text,
  selected_site_url text,
  site_permission_level text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected', 'connected', 'expired', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_search_console_connections_user_id_idx
  on public.google_search_console_connections (user_id);
create index if not exists google_search_console_connections_business_profile_id_idx
  on public.google_search_console_connections (business_profile_id);
create index if not exists google_search_console_connections_status_idx
  on public.google_search_console_connections (connection_status);

alter table public.google_search_console_connections enable row level security;

create policy "Users can view own search console connections"
  on public.google_search_console_connections
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own search console connections"
  on public.google_search_console_connections
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own search console connections"
  on public.google_search_console_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own search console connections"
  on public.google_search_console_connections
  for delete
  using (auth.uid() = user_id);

-- Discovered Search Console properties (sites the connected Google account can access),
-- surfaced for property selection. Never stores tokens.
create table if not exists public.google_search_console_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  connection_id uuid not null references public.google_search_console_connections (id) on delete cascade,
  site_url text not null,
  permission_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, site_url)
);

create index if not exists google_search_console_properties_user_id_idx
  on public.google_search_console_properties (user_id);
create index if not exists google_search_console_properties_connection_id_idx
  on public.google_search_console_properties (connection_id);

alter table public.google_search_console_properties enable row level security;

create policy "Users can view own search console properties"
  on public.google_search_console_properties for select using (auth.uid() = user_id);
create policy "Users can insert own search console properties"
  on public.google_search_console_properties for insert with check (auth.uid() = user_id);
create policy "Users can update own search console properties"
  on public.google_search_console_properties for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own search console properties"
  on public.google_search_console_properties for delete using (auth.uid() = user_id);

-- Normalized Search Analytics rows (query- and page-dimension), one snapshot per sync,
-- tagged `current` or `previous` so rising/declining and gaining/losing-visibility
-- comparisons don't require re-querying Google. Never raw API payloads.
create table if not exists public.google_search_console_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  connection_id uuid not null references public.google_search_console_connections (id) on delete cascade,
  dimension text not null check (dimension in ('query', 'page')),
  dimension_value text not null,
  period_label text not null check (period_label in ('current', 'previous')),
  period_start date not null,
  period_end date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(6, 4) not null default 0,
  position numeric(6, 2),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists google_search_console_metrics_user_id_idx
  on public.google_search_console_metrics (user_id);
create index if not exists google_search_console_metrics_business_profile_id_idx
  on public.google_search_console_metrics (business_profile_id);
create index if not exists google_search_console_metrics_connection_id_idx
  on public.google_search_console_metrics (connection_id);
create index if not exists google_search_console_metrics_lookup_idx
  on public.google_search_console_metrics (business_profile_id, dimension, period_label);

alter table public.google_search_console_metrics enable row level security;

create policy "Users can view own search console metrics"
  on public.google_search_console_metrics for select using (auth.uid() = user_id);
create policy "Users can insert own search console metrics"
  on public.google_search_console_metrics for insert with check (auth.uid() = user_id);
create policy "Users can delete own search console metrics"
  on public.google_search_console_metrics for delete using (auth.uid() = user_id);

create table if not exists public.google_search_console_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  connection_id uuid references public.google_search_console_connections (id) on delete set null,
  sync_status text not null default 'running'
    check (sync_status in ('running', 'success', 'partial', 'failed')),
  queries_synced integer not null default 0,
  pages_synced integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_search_console_sync_log_user_id_idx
  on public.google_search_console_sync_log (user_id);
create index if not exists google_search_console_sync_log_business_profile_id_idx
  on public.google_search_console_sync_log (business_profile_id);
create index if not exists google_search_console_sync_log_created_at_idx
  on public.google_search_console_sync_log (created_at desc);

alter table public.google_search_console_sync_log enable row level security;

create policy "Users can view own search console sync log"
  on public.google_search_console_sync_log for select using (auth.uid() = user_id);
create policy "Users can insert own search console sync log"
  on public.google_search_console_sync_log for insert with check (auth.uid() = user_id);
create policy "Users can update own search console sync log"
  on public.google_search_console_sync_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_google_search_console_connections_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_google_search_console_properties_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists google_search_console_connections_updated_at
  on public.google_search_console_connections;
create trigger google_search_console_connections_updated_at
  before update on public.google_search_console_connections
  for each row execute function public.set_google_search_console_connections_updated_at();

drop trigger if exists google_search_console_properties_updated_at
  on public.google_search_console_properties;
create trigger google_search_console_properties_updated_at
  before update on public.google_search_console_properties
  for each row execute function public.set_google_search_console_properties_updated_at();
