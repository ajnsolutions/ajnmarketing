-- Background jobs for async AI and integration workloads
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid references public.business_profiles (id) on delete set null,
  job_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer not null default 0 check (attempts >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists background_jobs_user_id_idx on public.background_jobs (user_id);
create index if not exists background_jobs_status_idx on public.background_jobs (status);
create index if not exists background_jobs_priority_idx on public.background_jobs (priority);
create index if not exists background_jobs_created_at_idx on public.background_jobs (created_at desc);
create index if not exists background_jobs_job_type_idx on public.background_jobs (job_type);
create index if not exists background_jobs_active_lookup_idx
  on public.background_jobs (user_id, business_profile_id, job_type, status);

alter table public.background_jobs enable row level security;

create policy "Users can view own background jobs"
  on public.background_jobs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own background jobs"
  on public.background_jobs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own background jobs"
  on public.background_jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_background_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists background_jobs_updated_at on public.background_jobs;

create trigger background_jobs_updated_at
  before update on public.background_jobs
  for each row
  execute function public.set_background_jobs_updated_at();
