-- AI Marketing Agent: daily task recommendations from marketing plan and workflow state
create table if not exists public.ai_marketing_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  marketing_plan_id uuid references public.marketing_plans (id) on delete set null,
  task_type text not null,
  title text not null,
  description text not null,
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'dismissed')),
  due_date date not null,
  related_content_id uuid references public.content_approvals (id) on delete set null,
  related_plan_item text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_marketing_tasks_user_id_idx on public.ai_marketing_tasks (user_id);
create index if not exists ai_marketing_tasks_business_profile_id_idx
  on public.ai_marketing_tasks (business_profile_id);
create index if not exists ai_marketing_tasks_status_idx on public.ai_marketing_tasks (status);
create index if not exists ai_marketing_tasks_due_date_idx on public.ai_marketing_tasks (due_date);
create index if not exists ai_marketing_tasks_user_due_date_idx
  on public.ai_marketing_tasks (user_id, due_date);

alter table public.ai_marketing_tasks enable row level security;

create policy "Users can view own marketing tasks"
  on public.ai_marketing_tasks
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing tasks"
  on public.ai_marketing_tasks
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing tasks"
  on public.ai_marketing_tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_ai_marketing_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_marketing_tasks_updated_at on public.ai_marketing_tasks;

create trigger ai_marketing_tasks_updated_at
  before update on public.ai_marketing_tasks
  for each row
  execute function public.set_ai_marketing_tasks_updated_at();
