-- Immutable audit trail for security-sensitive platform actions
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid references public.business_profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  status text not null check (status in ('started', 'success', 'failure')),
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_business_profile_id_idx
  on public.audit_logs (business_profile_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs"
  on public.audit_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own audit logs"
  on public.audit_logs
  for insert
  with check (auth.uid() = user_id);
