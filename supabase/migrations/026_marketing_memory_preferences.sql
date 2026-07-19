-- Marketing Memory Phase 3: customer preferences and overrides. See
-- docs/MARKETING_MEMORY_PREFERENCES.md for the full design rationale.
--
-- This migration creates exactly two tables:
--   marketing_memory_overrides    -- append-only evidence of a customer choice that
--                                   diverged from (or confirmed) a system suggestion
--   marketing_memory_preferences  -- explicit, customer-stated instructions (mutable
--                                   only via soft-deactivate + supersession; never
--                                   hard-deleted)
--
-- Circular FK (preference <-> override promotion links) is resolved by creating
-- overrides first without promoted_to_preference_id, then preferences with
-- promoted_from_override_id, then adding the reverse FK.
--
-- No Marketing Director, recommendation-scoring, or publishing-behavior wiring exists
-- in this migration or the code that uses it. Preferences and overrides are recorded
-- and readable; nothing in the decision pipeline consults them yet (Phase 4).
--
-- content_tone is deliberately excluded from preference_type's check constraint —
-- brand voice / voice_notes / preferred_words on business_profiles (and Brand Voice
-- settings) remain the sole authoritative tone surface. Phase 3 must not create a
-- competing instruction channel for the same concern.

-- ---------------------------------------------------------------------------
-- Overrides (append-only) — created first so preferences can reference them.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_memory_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  -- Phase 4 decision_links do not exist yet; nullable so Phase 3 can ship first.
  decision_link_id uuid null,
  override_type text not null check (
    override_type in (
      'chose_different_action',
      'chose_different_time',
      'disabled_context_factor',
      'marked_learning_incorrect',
      'deferred_recommendation'
    )
  ),
  related_learning_id uuid null references public.marketing_memory_learnings (id) on delete set null,
  -- Optional structured detail for the override (e.g. disabled context category,
  -- chosen day). Never a free-form inference — validated in application code.
  factor_type text null,
  factor_value text null,
  is_permanent boolean not null default false,
  -- Filled after preferences table exists (see ALTER below).
  promoted_to_preference_id uuid null,
  notes text null,
  -- Actor attribution: the authenticated customer who recorded this override.
  -- Never inferred; never a background job. Always equals the session user_id for
  -- customer-initiated writes in this phase.
  created_by uuid not null references auth.users (id) on delete cascade,
  -- Deterministic, server-computed. See lib/marketing-memory/preferenceIdempotency.ts.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint marketing_memory_overrides_idempotency_key unique (idempotency_key)
);

create index if not exists marketing_memory_overrides_business_created_idx
  on public.marketing_memory_overrides (business_profile_id, created_at desc);
create index if not exists marketing_memory_overrides_related_learning_idx
  on public.marketing_memory_overrides (related_learning_id)
  where related_learning_id is not null;
create index if not exists marketing_memory_overrides_user_id_idx
  on public.marketing_memory_overrides (user_id);

alter table public.marketing_memory_overrides enable row level security;

-- Append-only by policy: select + insert only. Overrides are evidence — you do not
-- edit history, you add to it.
create policy "Users can view own marketing memory overrides"
  on public.marketing_memory_overrides
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory overrides"
  on public.marketing_memory_overrides
  for insert
  with check (auth.uid() = user_id and auth.uid() = created_by);

-- Narrow update: only to set promoted_to_preference_id after a permanent override is
-- promoted. A trigger below rejects any other column mutation so history stays intact.
create policy "Users can link promotion on own marketing memory overrides"
  on public.marketing_memory_overrides
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.marketing_memory_overrides_promotion_only_guard()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.business_profile_id is distinct from old.business_profile_id
     or new.decision_link_id is distinct from old.decision_link_id
     or new.override_type is distinct from old.override_type
     or new.related_learning_id is distinct from old.related_learning_id
     or new.factor_type is distinct from old.factor_type
     or new.factor_value is distinct from old.factor_value
     or new.is_permanent is distinct from old.is_permanent
     or new.notes is distinct from old.notes
     or new.created_by is distinct from old.created_by
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'marketing_memory_overrides rows are append-only except promoted_to_preference_id';
  end if;

  if old.promoted_to_preference_id is not null
     and new.promoted_to_preference_id is distinct from old.promoted_to_preference_id then
    raise exception 'marketing_memory_overrides.promoted_to_preference_id cannot be changed once set';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_memory_overrides_promotion_only
  on public.marketing_memory_overrides;

create trigger marketing_memory_overrides_promotion_only
  before update on public.marketing_memory_overrides
  for each row
  execute function public.marketing_memory_overrides_promotion_only_guard();

-- ---------------------------------------------------------------------------
-- Preferences (soft-deactivate + supersession; no delete policy)
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_memory_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  preference_type text not null check (
    preference_type in (
      'channel_priority',
      'publishing_day_restriction',
      'context_category_toggle',
      'approval_requirement',
      'custom'
    )
  ),
  factor_type text null,
  factor_value text null,
  instruction_text text not null,
  is_active boolean not null default true,
  -- Only ever set by an explicit customer action — never a background decay job.
  active_until timestamptz null,
  source text not null default 'explicit_statement' check (
    source in ('explicit_statement', 'promoted_override')
  ),
  promoted_from_override_id uuid null
    references public.marketing_memory_overrides (id) on delete set null,
  -- When a customer replaces an active preference of the same key, the prior row is
  -- soft-deactivated and this points at it — audit history, never hard delete.
  supersedes_preference_id uuid null
    references public.marketing_memory_preferences (id) on delete set null,
  -- Actor attribution: who created / last mutated this row. created_by is required;
  -- updated_by is set on soft-deactivate, re-enable, or supersession bookkeeping.
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_by uuid null references auth.users (id) on delete set null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active preference per (business, type, factor_type, factor_value).
-- coalesce handles NULL factor columns so PostgreSQL's NULL-distinct unique behavior
-- cannot admit duplicate "active, no factor" rows.
create unique index if not exists marketing_memory_preferences_live_key_idx
  on public.marketing_memory_preferences (
    business_profile_id,
    preference_type,
    (coalesce(factor_type, '')),
    (coalesce(factor_value, ''))
  )
  where is_active = true;

create index if not exists marketing_memory_preferences_business_active_idx
  on public.marketing_memory_preferences (business_profile_id, is_active);
create index if not exists marketing_memory_preferences_user_id_idx
  on public.marketing_memory_preferences (user_id);
create index if not exists marketing_memory_preferences_promoted_from_idx
  on public.marketing_memory_preferences (promoted_from_override_id)
  where promoted_from_override_id is not null;

alter table public.marketing_memory_preferences enable row level security;

-- select/insert/update — no delete. Customers "remove" a preference by setting
-- is_active = false (and optionally active_until), preserving audit history.
create policy "Users can view own marketing memory preferences"
  on public.marketing_memory_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own marketing memory preferences"
  on public.marketing_memory_preferences
  for insert
  with check (auth.uid() = user_id and auth.uid() = created_by);

create policy "Users can update own marketing memory preferences"
  on public.marketing_memory_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_marketing_memory_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_memory_preferences_updated_at
  on public.marketing_memory_preferences;

create trigger marketing_memory_preferences_updated_at
  before update on public.marketing_memory_preferences
  for each row
  execute function public.set_marketing_memory_preferences_updated_at();

-- Reverse promotion link on overrides (circular FK, deferred until preferences exist).
alter table public.marketing_memory_overrides
  add constraint marketing_memory_overrides_promoted_to_preference_fk
  foreign key (promoted_to_preference_id)
  references public.marketing_memory_preferences (id)
  on delete set null;

-- Extend evidence_links source_type so a future (or Phase 3 optional) citation can
-- point at an override as contradicting evidence for a Learning — additive only;
-- every existing Phase 1/2 row remains valid.
alter table public.marketing_memory_evidence_links
  drop constraint if exists marketing_memory_evidence_links_source_type_check;

alter table public.marketing_memory_evidence_links
  add constraint marketing_memory_evidence_links_source_type_check
  check (
    source_type in (
      'recommendation',
      'recommendation_outcome_event',
      'content_approval',
      'publishing_job',
      'analytics_snapshot',
      'market_context_item',
      'monthly_focus',
      'observation',
      'override'
    )
  );
