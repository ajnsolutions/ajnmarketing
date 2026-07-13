-- Phase RC operational hardening: one Market Context brief per user per week.
-- Canonical ownership is user_id (Market Context reads/writes and RLS are user-scoped;
-- business_profiles also enforces unique(user_id), so profile is 1:1 with user today).
-- Enables atomic upsert claim and removes duplicate-week races from concurrent refreshes.

create unique index if not exists market_context_briefs_user_week_uidx
  on public.market_context_briefs (user_id, brief_start_date, brief_end_date);
