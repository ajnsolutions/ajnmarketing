-- Recommendation Explainability and Client Decision Experience: adds "do_more_like_this"
-- as a 9th recommendation_outcome_events event type -- a durable, positive-feedback
-- signal distinct from draft_approved (a client can approve a draft they don't
-- particularly want more of, and vice versa; these are deliberately separate signals).
--
-- No new uniqueness protection is needed: the existing unique constraint on
-- idempotency_key (migration 021) already covers this event type -- the application
-- layer keys it as "<content_approval_id>:do_more_like_this", one per draft, matching
-- draft_approved/draft_rejected's own idempotency pattern. RLS, indexes, and every other
-- structural property of the table are unchanged.

alter table public.recommendation_outcome_events
  drop constraint if exists recommendation_outcome_events_event_type_check;

alter table public.recommendation_outcome_events
  add constraint recommendation_outcome_events_event_type_check
  check (
    event_type in (
      'draft_created',
      'draft_edited',
      'draft_approved',
      'draft_rejected',
      'publishing_queued',
      'publishing_succeeded',
      'publishing_failed',
      'performance_measured',
      'do_more_like_this'
    )
  );
