-- Google Business Profile OAuth connections
create table if not exists public.google_business_profile_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  google_account_email text,
  google_account_name text,
  google_account_id text,
  gbp_account_id text,
  gbp_location_id text,
  gbp_location_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected', 'connected', 'expired', 'revoked', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_business_profile_connections_user_id_idx
  on public.google_business_profile_connections (user_id);
create index if not exists google_business_profile_connections_business_profile_id_idx
  on public.google_business_profile_connections (business_profile_id);
create index if not exists google_business_profile_connections_status_idx
  on public.google_business_profile_connections (connection_status);

alter table public.google_business_profile_connections enable row level security;

create policy "Users can view own google business profile connections"
  on public.google_business_profile_connections
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own google business profile connections"
  on public.google_business_profile_connections
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own google business profile connections"
  on public.google_business_profile_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own google business profile connections"
  on public.google_business_profile_connections
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_google_business_profile_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists google_business_profile_connections_updated_at
  on public.google_business_profile_connections;

create trigger google_business_profile_connections_updated_at
  before update on public.google_business_profile_connections
  for each row
  execute function public.set_google_business_profile_connections_updated_at();
