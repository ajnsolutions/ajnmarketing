-- Decision Intelligence & Learning Impact (Project Magic Phase 2F).
-- See docs/DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md.
--
-- Implements the table `docs/MARKETING_MEMORY_DATA_MODEL.md` §7 already proposed as
-- "marketing_memory_decision_links — PROPOSED (not yet implemented), Phase 4": an
-- audit-trail record of one MarketingDirectorDecision actually computed for a customer,
-- plus which Learnings/Preferences it consulted. This is not a new decision-making
-- table -- lib/marketing-director/resolveDecision.ts remains the sole place a decision
-- is made; this table only records that it happened.
--
-- There is no marketing_director_decisions table anywhere in this schema (see
-- resolveDecision.ts's own doc comment: decisions are computed per-request and never
-- persisted). This migration does not create one -- it persists a normalized,
-- server-authored SNAPSHOT of an already-computed decision, matching the "record, don't
-- decide" boundary the rest of Marketing Memory follows.
--
-- Also retrofits the FK on marketing_memory_overrides.decision_link_id, added
-- nullable-without-FK in migration 026 specifically "so Phase 3 can ship first" (026's
-- own comment) pending this table's arrival. marketing_memory_preferences has no
-- equivalent column (only overrides does) -- verified against 026's actual DDL rather
-- than assumed from documentation prose.

create table if not exists public.marketing_memory_decision_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  decision_type text not null check (
    decision_type in (
      'meaningful_decision',
      'approval_needed',
      'high_value_recommendation',
      'opportunity',
      'reassurance',
      'celebration'
    )
  ),
  title text not null,
  -- Customer-safe copy only -- mirrors MarketingDirectorDecision.summary. Never raw
  -- rationale/supportingSignals (internal-only fields, never persisted here).
  customer_summary text not null,
  priority_rank integer not null default 0,
  -- Mirrors HeadOfMarketingPrimaryActionKind (lib/head-of-marketing/types.ts) — not
  -- constrained here since that union is app-level and evolves independently; validated
  -- in application code instead, matching recommended_action_type's own precedent risk
  -- profile (a purely descriptive label, not an authorization control).
  action_type text null,
  source_recommendation_id uuid null references public.marketing_recommendations (id) on delete set null,
  source_campaign_id uuid null references public.marketing_campaigns (id) on delete set null,
  -- Explicit IDs the decision actually consulted (see
  -- lib/marketing-director/memoryComposition.ts's appliedPreferenceIds/
  -- consideredLearningIds) -- never inferred by matching on descriptive text.
  consulted_learning_ids uuid[] not null default '{}',
  consulted_preference_ids uuid[] not null default '{}',
  -- Bounded, server-authored record of evidence that existed but did not influence this
  -- decision: [{ id, evidenceType: 'learning' | 'preference', reason }], mirroring
  -- MarketingDirectorMemoryContext.ignoredLearnings/ignoredPreferences (both already
  -- {id, reason} shaped). Answers "what was ignored" honestly instead of only "what was
  -- applied". Capped at 10 entries by application code -- this is a display aid, not an
  -- unrestricted audit dump.
  ignored_evidence jsonb not null default '[]'::jsonb,
  was_cold_start boolean not null default false,
  decision_status text not null default 'active' check (decision_status in ('active', 'superseded')),
  evidence_version smallint not null default 1,
  -- Deterministic hash of the decision-relevant inputs (candidate set, evidence package,
  -- selected decision fields) -- see lib/decision-intelligence/fingerprint.ts. Two
  -- snapshot attempts with identical inputs collide on this and the second is a no-op
  -- (idempotent); a real input change always produces a different fingerprint.
  input_fingerprint text not null,
  supersedes_decision_id uuid null references public.marketing_memory_decision_links (id) on delete set null,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint marketing_memory_decision_links_no_self_supersession check (id is distinct from supersedes_decision_id),
  constraint marketing_memory_decision_links_idempotency_key unique (business_profile_id, input_fingerprint)
);

create index if not exists marketing_memory_decision_links_business_evaluated_idx
  on public.marketing_memory_decision_links (business_profile_id, evaluated_at desc);
create index if not exists marketing_memory_decision_links_user_id_idx
  on public.marketing_memory_decision_links (user_id);
create index if not exists marketing_memory_decision_links_consulted_learning_ids_idx
  on public.marketing_memory_decision_links using gin (consulted_learning_ids);
create index if not exists marketing_memory_decision_links_consulted_preference_ids_idx
  on public.marketing_memory_decision_links using gin (consulted_preference_ids);
create index if not exists marketing_memory_decision_links_supersedes_idx
  on public.marketing_memory_decision_links (supersedes_decision_id)
  where supersedes_decision_id is not null;

alter table public.marketing_memory_decision_links enable row level security;

create policy "Users can view own marketing memory decision links"
  on public.marketing_memory_decision_links
  for select
  using (auth.uid() = user_id);

-- Written inline as a byproduct of the tenant's own Head of Marketing page load, using
-- the normal session-scoped client -- the same pattern already established for
-- marketing_memory_observations/context_snapshots/evidence_links (all session-scoped
-- INSERT policies, migration 024), not the service-role-only pattern used for
-- marketing_experiment_proposals (029). A decision snapshot is a passive record of what
-- Marketing Director already decided for this tenant, not an independent determination a
-- client could fake authority over -- unlike an experiment proposal, there is no
-- "approval" a snapshot grants.
create policy "Users can insert own marketing memory decision links"
  on public.marketing_memory_decision_links
  for insert
  with check (auth.uid() = user_id);

-- Supersession requires a narrow UPDATE: only decision_status may change, and only
-- active -> superseded. No other field may ever change after insert.
create policy "Users can supersede own marketing memory decision links"
  on public.marketing_memory_decision_links
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.enforce_marketing_memory_decision_links_immutable()
returns trigger
language plpgsql
as $$
begin
  if (
    new.business_profile_id is distinct from old.business_profile_id
    or new.user_id is distinct from old.user_id
    or new.decision_type is distinct from old.decision_type
    or new.title is distinct from old.title
    or new.customer_summary is distinct from old.customer_summary
    or new.priority_rank is distinct from old.priority_rank
    or new.action_type is distinct from old.action_type
    or new.source_recommendation_id is distinct from old.source_recommendation_id
    or new.source_campaign_id is distinct from old.source_campaign_id
    or new.consulted_learning_ids is distinct from old.consulted_learning_ids
    or new.consulted_preference_ids is distinct from old.consulted_preference_ids
    or new.ignored_evidence is distinct from old.ignored_evidence
    or new.was_cold_start is distinct from old.was_cold_start
    or new.evidence_version is distinct from old.evidence_version
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.supersedes_decision_id is distinct from old.supersedes_decision_id
    or new.evaluated_at is distinct from old.evaluated_at
  ) then
    raise exception 'marketing_memory_decision_links: decision facts are immutable after creation (only decision_status may change)'
      using errcode = '23514';
  end if;

  if new.decision_status is distinct from old.decision_status
     and not (old.decision_status = 'active' and new.decision_status = 'superseded') then
    raise exception 'Invalid marketing_memory_decision_links status transition: % -> %', old.decision_status, new.decision_status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_memory_decision_links_guard_immutable on public.marketing_memory_decision_links;

create trigger marketing_memory_decision_links_guard_immutable
  before update on public.marketing_memory_decision_links
  for each row
  execute function public.enforce_marketing_memory_decision_links_immutable();

-- Retrofit: these columns were added nullable-without-FK in 026 specifically pending
-- this table (026's own comment: "Phase 4 decision_links do not exist yet; nullable so
-- Phase 3 can ship first" / "decision_link_id cannot FK until Phase 4"). Additive,
-- non-destructive -- existing null values remain valid under the new FK.
alter table public.marketing_memory_overrides
  add constraint marketing_memory_overrides_decision_link_id_fkey
  foreign key (decision_link_id) references public.marketing_memory_decision_links (id) on delete set null;
