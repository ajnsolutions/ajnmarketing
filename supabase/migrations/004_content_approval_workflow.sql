-- Content approval workflow: queue AI-generated assets before publishing
create table if not exists public.content_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  content_type text not null,
  title text not null,
  content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'published')),
  source text not null default 'content_generator',
  version integer not null default 1 check (version >= 1),
  ai_score integer check (ai_score >= 0 and ai_score <= 100),
  notes text,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_approvals_user_id_idx on public.content_approvals (user_id);
create index if not exists content_approvals_business_profile_id_idx
  on public.content_approvals (business_profile_id);
create index if not exists content_approvals_status_idx on public.content_approvals (status);
create index if not exists content_approvals_created_at_idx on public.content_approvals (created_at desc);

alter table public.content_approvals enable row level security;

create policy "Users can view own content approvals"
  on public.content_approvals
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own content approvals"
  on public.content_approvals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own content approvals"
  on public.content_approvals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_content_approvals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_approvals_updated_at on public.content_approvals;

create trigger content_approvals_updated_at
  before update on public.content_approvals
  for each row
  execute function public.set_content_approvals_updated_at();
