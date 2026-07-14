-- Assisted Pilot Framework: internal-only tables for operating owned pilot businesses
-- (MySafetyTeam, Sunspots, …) before Trigger.dev schedule activation.
-- Admin routes use the service-role client (bypasses RLS). Authenticated tenant roles
-- get no policies → denied by default. Never expose these tables to customer UI.

create table if not exists public.pilot_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'blocked')),
  start_date date not null default (timezone('utc', now()))::date,
  current_cycle integer not null default 1 check (current_cycle >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_businesses_profile_unique unique (business_profile_id)
);

create index if not exists pilot_businesses_user_id_idx
  on public.pilot_businesses (user_id);
create index if not exists pilot_businesses_status_idx
  on public.pilot_businesses (status);

create table if not exists public.pilot_checklist_items (
  id uuid primary key default gen_random_uuid(),
  pilot_business_id uuid not null references public.pilot_businesses (id) on delete cascade,
  stage_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'blocked', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now(),
  constraint pilot_checklist_items_stage_unique unique (pilot_business_id, stage_key)
);

create index if not exists pilot_checklist_items_pilot_business_id_idx
  on public.pilot_checklist_items (pilot_business_id);
create index if not exists pilot_checklist_items_status_idx
  on public.pilot_checklist_items (status);

create table if not exists public.pilot_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_business_id uuid references public.pilot_businesses (id) on delete set null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (
    category in (
      'ux',
      'ai_quality',
      'publishing',
      'oauth',
      'analytics',
      'recommendation_quality',
      'performance',
      'security',
      'operational',
      'documentation'
    )
  ),
  workflow_stage text,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  owner text,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_issues_pilot_business_id_idx
  on public.pilot_issues (pilot_business_id);
create index if not exists pilot_issues_status_idx
  on public.pilot_issues (status);
create index if not exists pilot_issues_severity_idx
  on public.pilot_issues (severity);

create table if not exists public.pilot_manual_action_runs (
  id uuid primary key default gen_random_uuid(),
  pilot_business_id uuid not null references public.pilot_businesses (id) on delete cascade,
  action_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  result text not null default 'running'
    check (result in ('running', 'success', 'failure', 'skipped')),
  error_message text,
  triggered_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pilot_manual_action_runs_pilot_business_id_idx
  on public.pilot_manual_action_runs (pilot_business_id);
create index if not exists pilot_manual_action_runs_started_at_idx
  on public.pilot_manual_action_runs (started_at desc);

alter table public.pilot_businesses enable row level security;
alter table public.pilot_checklist_items enable row level security;
alter table public.pilot_issues enable row level security;
alter table public.pilot_manual_action_runs enable row level security;

-- No authenticated policies: tenant clients cannot read/write pilot ops tables.
-- Service-role (admin API / Trigger.dev) bypasses RLS.
