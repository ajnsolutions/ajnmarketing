-- Track when a Google Business Profile connection was last live-verified against Google,
-- so the status endpoint can cache verification results instead of calling Google on every load.
alter table public.google_business_profile_connections
  add column if not exists last_verified_at timestamptz;
