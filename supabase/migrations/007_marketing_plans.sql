-- AI Marketing Planner: monthly strategy plans generated from business intelligence
create table if not exists public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null check (year >= 2020 and year <= 2100),
  status text not null default 'generating'
    check (status in ('generating', 'active', 'failed')),
  plan_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_plans_user_month_year_idx
  on public.marketing_plans (user_id, year, month);
create index if not exists marketing_plans_user_id_idx on public.marketing_plans (user_id);
create index if not exists marketing_plans_business_profile_id_idx
  on public.marketing_plans (business_profile_id);
create index if not exists marketing_plans_status_idx on public.marketing_plans (status);
create index if not exists marketing_plans_created_at_idx on public.marketing_plans (created_at desc);

alter table public.marketing_plans enable row level security;

create policy "Users can view own marketing plans"
  on public.marketing_plans
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing plans"
  on public.marketing_plans
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own marketing plans"
  on public.marketing_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own marketing plans"
  on public.marketing_plans
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_marketing_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_plans_updated_at on public.marketing_plans;

create trigger marketing_plans_updated_at
  before update on public.marketing_plans
  for each row
  execute function public.set_marketing_plans_updated_at();
