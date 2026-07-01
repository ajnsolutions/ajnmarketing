-- Autonomous Publishing Engine: jobs and history trail
create table if not exists public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  content_id uuid not null references public.publishing_queue (id) on delete cascade,
  provider text not null
    check (provider in ('google_business_profile', 'facebook', 'instagram', 'linkedin', 'email')),
  provider_post_id text,
  status text not null default 'queued'
    check (status in (
      'queued',
      'scheduled',
      'publishing',
      'published',
      'verified',
      'retrying',
      'failed',
      'cancelled'
    )),
  scheduled_for timestamptz,
  published_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publishing_history (
  id uuid primary key default gen_random_uuid(),
  publishing_job_id uuid not null references public.publishing_jobs (id) on delete cascade,
  action text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists publishing_jobs_user_id_idx on public.publishing_jobs (user_id);
create index if not exists publishing_jobs_business_profile_id_idx
  on public.publishing_jobs (business_profile_id);
create index if not exists publishing_jobs_content_id_idx on public.publishing_jobs (content_id);
create index if not exists publishing_jobs_provider_idx on public.publishing_jobs (provider);
create index if not exists publishing_jobs_status_idx on public.publishing_jobs (status);
create index if not exists publishing_jobs_scheduled_for_idx
  on public.publishing_jobs (scheduled_for);
create index if not exists publishing_jobs_created_at_idx
  on public.publishing_jobs (created_at desc);

create index if not exists publishing_history_publishing_job_id_idx
  on public.publishing_history (publishing_job_id);
create index if not exists publishing_history_created_at_idx
  on public.publishing_history (created_at desc);

alter table public.publishing_jobs enable row level security;
alter table public.publishing_history enable row level security;

create policy "Users can view own publishing jobs"
  on public.publishing_jobs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own publishing jobs"
  on public.publishing_jobs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own publishing jobs"
  on public.publishing_jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own publishing jobs"
  on public.publishing_jobs
  for delete
  using (auth.uid() = user_id);

create policy "Users can view own publishing history"
  on public.publishing_history
  for select
  using (
    exists (
      select 1
      from public.publishing_jobs pj
      where pj.id = publishing_history.publishing_job_id
        and pj.user_id = auth.uid()
    )
  );

create policy "Users can insert own publishing history"
  on public.publishing_history
  for insert
  with check (
    exists (
      select 1
      from public.publishing_jobs pj
      where pj.id = publishing_history.publishing_job_id
        and pj.user_id = auth.uid()
    )
  );

create or replace function public.set_publishing_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists publishing_jobs_updated_at on public.publishing_jobs;

create trigger publishing_jobs_updated_at
  before update on public.publishing_jobs
  for each row
  execute function public.set_publishing_jobs_updated_at();
