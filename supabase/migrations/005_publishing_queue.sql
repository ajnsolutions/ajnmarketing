-- Publishing queue: organize approved content for future platform publishing
create table if not exists public.publishing_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  content_approval_id uuid not null references public.content_approvals (id) on delete cascade,
  platform text not null
    check (platform in ('google_business_profile', 'facebook', 'instagram', 'linkedin', 'email')),
  title text not null,
  content text not null,
  status text not null default 'ready'
    check (status in ('ready', 'scheduled', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  publish_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publishing_queue_user_id_idx on public.publishing_queue (user_id);
create index if not exists publishing_queue_business_profile_id_idx
  on public.publishing_queue (business_profile_id);
create index if not exists publishing_queue_content_approval_id_idx
  on public.publishing_queue (content_approval_id);
create index if not exists publishing_queue_status_idx on public.publishing_queue (status);
create index if not exists publishing_queue_scheduled_for_idx on public.publishing_queue (scheduled_for);
create index if not exists publishing_queue_created_at_idx on public.publishing_queue (created_at desc);

alter table public.publishing_queue enable row level security;

create policy "Users can view own publishing queue items"
  on public.publishing_queue
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own publishing queue items"
  on public.publishing_queue
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own publishing queue items"
  on public.publishing_queue
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own publishing queue items"
  on public.publishing_queue
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_publishing_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists publishing_queue_updated_at on public.publishing_queue;

create trigger publishing_queue_updated_at
  before update on public.publishing_queue
  for each row
  execute function public.set_publishing_queue_updated_at();
