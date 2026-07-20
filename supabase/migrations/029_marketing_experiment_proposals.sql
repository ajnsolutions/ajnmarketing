-- Marketing Experiment Proposals (Project Magic Phase 2E, follow-up).
-- See docs/MARKETING_EXPERIMENTATION_ENGINE.md.
--
-- Applies after 028_marketing_experimentation.sql. Closes the gap found in review: the
-- original PR accepted a client-supplied, unverified "marketing_director_decision_key"
-- string as its only gate on experiment creation — any authenticated user could create an
-- experiment for any of their own open recommendations via a direct API call.
--
-- There is no persisted `marketing_director_decisions` table anywhere in this schema —
-- Marketing Director decisions are computed fresh per-request by
-- lib/marketing-director/resolveDecision.ts and never written to the database (see that
-- module's own doc comment: "Nothing here re-scores a recommendation, calls OpenAI, or
-- writes to the database"). This migration does not invent a parallel decision-persistence
-- system. Instead, `marketing_experiment_proposals` itself becomes the first durable
-- artifact of a specific Marketing Director determination: each row is written only by
-- server-side eligibility evaluation (lib/marketing-director/experimentEligibility.ts,
-- invoked only via the service-role client from the admin-gated
-- app/api/admin/trigger-experiment-proposal-evaluation route — never reachable by a
-- normal tenant request), and its decision_reason + marketing_director_decision_key +
-- created_at collectively form the audit record of that determination.

create table if not exists public.marketing_experiment_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  recommendation_id uuid not null references public.marketing_recommendations (id) on delete restrict,
  campaign_id uuid null references public.marketing_campaigns (id) on delete set null,
  experiment_type text not null check (
    -- Narrower than marketing_experiments.experiment_type: only types with an existing,
    -- realistic future per-variant attribution path are proposable (see docs — posting
    -- time and review-request timing both map onto existing publishing_queue timestamps;
    -- content_format/cta_variation/messaging_style/image_vs_text/campaign_sequencing all
    -- require inventing new content-classification metadata that does not exist yet, so
    -- they are deferred rather than proposable today).
    experiment_type in ('posting_time', 'review_request_timing')
  ),
  title text not null,
  hypothesis text not null,
  -- Declarative, bounded control/treatment definitions: { key, label, description }.
  -- Explicit roles (not an unordered variants array) per the prior review's "control and
  -- treatment roles are explicit" finding.
  control_definition jsonb not null,
  treatment_definition jsonb not null,
  primary_kpi text not null check (
    primary_kpi in ('engagement', 'clicks', 'reviews', 'reach', 'conversions', 'publishingConsistency')
  ),
  secondary_kpis jsonb not null default '[]'::jsonb,
  measurement_window_days smallint not null check (
    measurement_window_days > 0 and measurement_window_days <= 90
  ),
  proposal_status text not null default 'pending' check (
    proposal_status in ('pending', 'approved', 'expired')
  ),
  decision_reason text not null,
  -- Provenance snapshot of the eligibility determination, not a client-supplied or
  -- client-verifiable token — see the module doc comment above.
  marketing_director_decision_key text not null,
  template_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz null,
  approved_by uuid null references auth.users (id),
  converted_experiment_id uuid null references public.marketing_experiments (id) on delete set null,
  constraint marketing_experiment_proposals_approval_fields_consistent check (
    (proposal_status = 'approved') = (approved_at is not null and approved_by is not null)
  )
);

-- At most one pending proposal per (business, recommendation, experiment_type) — the
-- eligibility rule's own duplicate check (application layer) is backed by this DB-level
-- guarantee. A new pending proposal may still be created after an old one expires.
create unique index if not exists marketing_experiment_proposals_one_pending_idx
  on public.marketing_experiment_proposals (business_profile_id, recommendation_id, experiment_type)
  where proposal_status = 'pending';

-- At most one experiment may ever claim a given proposal (belt-and-suspenders — the
-- unique constraint on marketing_experiments.source_proposal_id, added below, is the
-- primary guarantee; this index additionally prevents two proposal rows from both
-- claiming to have converted to the same experiment).
create unique index if not exists marketing_experiment_proposals_converted_experiment_idx
  on public.marketing_experiment_proposals (converted_experiment_id)
  where converted_experiment_id is not null;

create index if not exists marketing_experiment_proposals_business_status_idx
  on public.marketing_experiment_proposals (business_profile_id, proposal_status);
create index if not exists marketing_experiment_proposals_recommendation_idx
  on public.marketing_experiment_proposals (recommendation_id);
create index if not exists marketing_experiment_proposals_user_id_idx
  on public.marketing_experiment_proposals (user_id);

alter table public.marketing_experiment_proposals enable row level security;

-- Read-only for the owning tenant. There is deliberately no INSERT policy for the
-- `authenticated` role at all (default-deny) — proposals are written only by the
-- service-role client from the admin-gated evaluation route, which bypasses RLS
-- entirely and therefore needs no policy. A normal authenticated user, even calling
-- Supabase directly with their own session JWT, cannot insert a proposal.
create policy "Users can view own marketing experiment proposals"
  on public.marketing_experiment_proposals
  for select
  using (auth.uid() = user_id);

-- UPDATE is permitted for the owning tenant — this is how the tenant-facing approval
-- command (a normal authenticated API route, using the session-scoped client like every
-- other write in this codebase) performs its pending -> approved transition. The trigger
-- below restricts exactly which fields that UPDATE may actually change, so this policy
-- being ownership-only does not reopen "client can modify proposal definition".
create policy "Users can approve own marketing experiment proposals"
  on public.marketing_experiment_proposals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_marketing_experiment_proposals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_experiment_proposals_updated_at on public.marketing_experiment_proposals;

create trigger marketing_experiment_proposals_updated_at
  before update on public.marketing_experiment_proposals
  for each row
  execute function public.set_marketing_experiment_proposals_updated_at();

-- [Mutation guard] RLS's "own rows" UPDATE policy above is ownership-only. Without this
-- trigger, an authenticated user could call Supabase directly and rewrite their own
-- proposal's experiment_type, hypothesis, control/treatment definitions, primary_kpi, or
-- recommendation_id/campaign_id after the fact — i.e. define their own experiment and
-- have it "approved" under Marketing Director's name. This trigger allows exactly one
-- semantic transition (pending -> approved, only ever setting approved_at/approved_by/
-- converted_experiment_id) or expiring a stale proposal (pending -> expired), and
-- rejects every other change, including any attempt to modify the proposal's
-- authoritative definition at any status.
create or replace function public.enforce_marketing_experiment_proposal_mutation()
returns trigger
language plpgsql
as $$
begin
  if (
    new.recommendation_id is distinct from old.recommendation_id
    or new.campaign_id is distinct from old.campaign_id
    or new.experiment_type is distinct from old.experiment_type
    or new.title is distinct from old.title
    or new.hypothesis is distinct from old.hypothesis
    or new.control_definition is distinct from old.control_definition
    or new.treatment_definition is distinct from old.treatment_definition
    or new.primary_kpi is distinct from old.primary_kpi
    or new.secondary_kpis is distinct from old.secondary_kpis
    or new.measurement_window_days is distinct from old.measurement_window_days
    or new.decision_reason is distinct from old.decision_reason
    or new.marketing_director_decision_key is distinct from old.marketing_director_decision_key
    or new.template_id is distinct from old.template_id
    or new.business_profile_id is distinct from old.business_profile_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'marketing_experiment_proposals: definition fields are immutable after creation'
      using errcode = '23514';
  end if;

  if new.proposal_status is distinct from old.proposal_status then
    if not (
      (old.proposal_status = 'pending' and new.proposal_status = 'approved')
      or (old.proposal_status = 'pending' and new.proposal_status = 'expired')
    ) then
      raise exception
        'Invalid marketing_experiment_proposals status transition: % -> %', old.proposal_status, new.proposal_status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_experiment_proposals_guard_mutation on public.marketing_experiment_proposals;

create trigger marketing_experiment_proposals_guard_mutation
  before update on public.marketing_experiment_proposals
  for each row
  execute function public.enforce_marketing_experiment_proposal_mutation();

-- Experiment-to-proposal relationship: every experiment created from this point forward
-- must reference the proposal it was converted from. Nullable for schema safety (no
-- backfill required, non-destructive), but the insert-guard trigger below requires it to
-- be set on every new row going forward — direct/legacy-style inserts without an
-- approved proposal are rejected at the database layer, not just in application code.
alter table public.marketing_experiments
  add column if not exists source_proposal_id uuid
    references public.marketing_experiment_proposals (id) on delete restrict;

-- At most one experiment may ever be created from a given proposal.
create unique index if not exists marketing_experiments_source_proposal_idx
  on public.marketing_experiments (source_proposal_id)
  where source_proposal_id is not null;

-- [Insert guard] Enforces "direct experiment inserts without an approved proposal are
-- rejected" at the database layer. RLS's existing INSERT policy on marketing_experiments
-- (migration 028) is ownership-only ("auth.uid() = user_id") and cannot express this —
-- without this trigger, a user could still call Supabase directly and insert an
-- arbitrary experiment row naming any experiment_type/hypothesis/variants they like, as
-- long as they set user_id to themselves, bypassing the entire proposal chain even after
-- the client-side decision-key bypass was removed from the API layer.
create or replace function public.enforce_marketing_experiment_requires_approved_proposal()
returns trigger
language plpgsql
as $$
declare
  proposal record;
begin
  if new.source_proposal_id is null then
    raise exception 'marketing_experiments: source_proposal_id is required (experiments may only be created from an approved proposal)'
      using errcode = '23514';
  end if;

  select proposal_status, user_id, business_profile_id, recommendation_id, campaign_id, experiment_type
    into proposal
    from public.marketing_experiment_proposals
    where id = new.source_proposal_id;

  if not found then
    raise exception 'marketing_experiments: source_proposal_id does not reference an existing proposal'
      using errcode = '23514';
  end if;

  if proposal.proposal_status <> 'approved' then
    raise exception 'marketing_experiments: source proposal is not approved (status: %)', proposal.proposal_status
      using errcode = '23514';
  end if;

  if proposal.user_id <> new.user_id or proposal.business_profile_id <> new.business_profile_id then
    raise exception 'marketing_experiments: experiment tenant does not match proposal tenant'
      using errcode = '23514';
  end if;

  if proposal.recommendation_id <> new.created_from_recommendation_id then
    raise exception 'marketing_experiments: experiment recommendation does not match proposal recommendation'
      using errcode = '23514';
  end if;

  if coalesce(proposal.campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
     <> coalesce(new.related_campaign_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'marketing_experiments: experiment campaign does not match proposal campaign'
      using errcode = '23514';
  end if;

  if proposal.experiment_type <> new.experiment_type then
    raise exception 'marketing_experiments: experiment type does not match proposal experiment type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_experiments_guard_requires_proposal on public.marketing_experiments;

create trigger marketing_experiments_guard_requires_proposal
  before insert on public.marketing_experiments
  for each row
  execute function public.enforce_marketing_experiment_requires_approved_proposal();

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
      'override',
      'campaign',
      'experiment',
      'experiment_proposal'
    )
  );
