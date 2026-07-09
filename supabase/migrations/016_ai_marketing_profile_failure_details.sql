-- Store structured failure details on the AI marketing profile row itself so a failed
-- generation can be troubleshot and surfaced to the user without digging through audit logs.
alter table public.ai_marketing_profiles
  add column if not exists last_error jsonb,
  add column if not exists last_error_at timestamptz;
