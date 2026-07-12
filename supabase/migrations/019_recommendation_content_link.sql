-- Phase 2A.3: Recommendation-to-Content Drafting
-- Links content_approvals drafts to marketing_recommendations and adds in_progress
-- so a recommendation can track that drafting has started without completing it.

-- 1) Expand recommendation status to include in_progress (draft created, not done).
alter table public.marketing_recommendations
  drop constraint if exists marketing_recommendations_status_check;

alter table public.marketing_recommendations
  add constraint marketing_recommendations_status_check
  check (status in ('open', 'in_progress', 'dismissed', 'completed', 'superseded'));

-- 2) Link drafts back to the recommendation that produced them.
alter table public.content_approvals
  add column if not exists marketing_recommendation_id uuid
    references public.marketing_recommendations (id) on delete set null;

create index if not exists content_approvals_marketing_recommendation_id_idx
  on public.content_approvals (marketing_recommendation_id);

-- At most one active (non-rejected) draft per recommendation. Rejected drafts do not
-- block regeneration. Concurrent inserts race safely against this index.
create unique index if not exists content_approvals_active_recommendation_idx
  on public.content_approvals (marketing_recommendation_id)
  where marketing_recommendation_id is not null
    and status in ('pending', 'approved', 'published');
