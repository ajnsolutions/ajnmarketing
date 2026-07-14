-- Recommendation Outcome Feedback Loop: durable, append-only lifecycle events for
-- recommendation-generated content, plus the smallest compatible extension to
-- content_approvals needed to capture a structured rejection reason.
--
-- This table is intentionally separate from public.audit_logs. audit_logs is a generic,
-- duplicate-tolerant trail (entity_type/entity_id text pairs, no uniqueness constraint,
-- freely re-logged on retries) used for operational diagnostics -- it is not typed for
-- recommendation/content-approval/publishing-job relationships and has no idempotency
-- guarantee, so it cannot serve as the source of truth for deduplicated outcome state.
-- recommendation_outcome_events is that source of truth: one durable, uniquely-keyed row
-- per real lifecycle transition, safe for deterministic aggregation.

create table if not exists public.recommendation_outcome_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  recommendation_id uuid not null references public.marketing_recommendations (id) on delete cascade,
  content_approval_id uuid references public.content_approvals (id) on delete set null,
  publishing_job_id uuid references public.publishing_jobs (id) on delete set null,
  event_type text not null check (
    event_type in (
      'draft_created',
      'draft_edited',
      'draft_approved',
      'draft_rejected',
      'publishing_queued',
      'publishing_succeeded',
      'publishing_failed',
      'performance_measured'
    )
  ),
  event_version integer not null default 1,
  source text not null default 'system',
  -- Deterministic, server-computed dedupe identity for this exact transition (e.g.
  -- "<content_approval_id>:draft_approved", "<content_approval_id>:draft_edited:<hash>",
  -- "<publishing_job_id>:publishing_succeeded"). Never client-supplied.
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint recommendation_outcome_events_idempotency_key unique (idempotency_key)
);

create index if not exists recommendation_outcome_events_recommendation_id_idx
  on public.recommendation_outcome_events (recommendation_id);
create index if not exists recommendation_outcome_events_content_approval_id_idx
  on public.recommendation_outcome_events (content_approval_id);
create index if not exists recommendation_outcome_events_publishing_job_id_idx
  on public.recommendation_outcome_events (publishing_job_id);
create index if not exists recommendation_outcome_events_business_profile_id_idx
  on public.recommendation_outcome_events (business_profile_id);
create index if not exists recommendation_outcome_events_user_id_idx
  on public.recommendation_outcome_events (user_id);
create index if not exists recommendation_outcome_events_event_type_idx
  on public.recommendation_outcome_events (event_type);
create index if not exists recommendation_outcome_events_created_at_idx
  on public.recommendation_outcome_events (created_at desc);
-- Backs "all events for recommendation X, in order" -- the summary/reconciliation query.
create index if not exists recommendation_outcome_events_recommendation_created_idx
  on public.recommendation_outcome_events (recommendation_id, created_at);

alter table public.recommendation_outcome_events enable row level security;

-- Append-only by policy: select + insert only, no update/delete policy exists for any
-- role, so authenticated users (and the anon role) can never modify or remove a row
-- once written. Service-role writes (Trigger.dev / admin reconciliation) bypass RLS
-- entirely, as with every other privileged table in this schema.
create policy "Users can view own recommendation outcome events"
  on public.recommendation_outcome_events
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own recommendation outcome events"
  on public.recommendation_outcome_events
  for insert
  with check (auth.uid() = user_id);

-- Smallest compatible extension for structured rejection reasons. rejected_reason (free
-- text / optional comment) already exists and is preserved unchanged; this adds an
-- optional structured code alongside it rather than replacing it.
alter table public.content_approvals
  add column if not exists rejection_reason_code text
    check (
      rejection_reason_code is null
      or rejection_reason_code in (
        'too_promotional',
        'wrong_tone',
        'incorrect_information',
        'off_brand_topic',
        'poor_timing',
        'duplicate_content',
        'other'
      )
    );
