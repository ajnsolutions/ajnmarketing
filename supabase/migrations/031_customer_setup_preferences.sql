-- Customer setup preferences (Project Magic Phase 3B).
-- Stores only non-derivable customer choices: skips, educational acknowledgements,
-- dismissals, and last visited step. Completion of real product steps is always
-- derived from existing business/profile/integration data.

create table if not exists public.customer_setup_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  skipped_step_keys text[] not null default '{}'::text[],
  acknowledged_step_keys text[] not null default '{}'::text[],
  onboarding_dismissed_at timestamptz null,
  setup_completed_acknowledged_at timestamptz null,
  last_visited_step_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_setup_preferences_business_unique unique (business_profile_id)
);

create index if not exists customer_setup_preferences_user_id_idx
  on public.customer_setup_preferences (user_id);

alter table public.customer_setup_preferences enable row level security;

drop policy if exists "Users can view own customer setup preferences"
  on public.customer_setup_preferences;
drop policy if exists "Users can insert own customer setup preferences"
  on public.customer_setup_preferences;
drop policy if exists "Users can update own customer setup preferences"
  on public.customer_setup_preferences;

create policy "Users can view own customer setup preferences"
  on public.customer_setup_preferences
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.business_profiles bp
      where bp.id = business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert own customer setup preferences"
  on public.customer_setup_preferences
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.business_profiles bp
      where bp.id = business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can update own customer setup preferences"
  on public.customer_setup_preferences
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.business_profiles bp
      where bp.id = business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.business_profiles bp
      where bp.id = business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create or replace function public.set_customer_setup_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_setup_preferences_updated_at on public.customer_setup_preferences;

create trigger customer_setup_preferences_updated_at
  before update on public.customer_setup_preferences
  for each row
  execute function public.set_customer_setup_preferences_updated_at();
