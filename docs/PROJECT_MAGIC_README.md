# Project Magic docs — integrity check

This file exists only so unit tests can assert the blueprint set is complete without coupling to product runtime.

Required constitution documents:

- PROJECT_MAGIC_MANIFESTO.md
- MAGIC_BLUEPRINT.md
- CUSTOMER_JOURNEYS.md
- MARKETING_HEALTH.md
- TRUST_MODEL.md
- VOICE_AND_PERSONALITY.md
- NAVIGATION_PHILOSOPHY.md
- DASHBOARD_PHILOSOPHY.md
- IMPLEMENTATION_ROADMAP.md

Implementation notes (post-blueprint):

- FIRST_FIVE_MINUTES.md — Phase B conversational onboarding + first dashboard
- ONE_HEAD_OF_MARKETING.md — unified customer decision surface + Marketing Health v1
- MEET_YOUR_HEAD_OF_MARKETING.md — conversation philosophy + progressive setup introduction
- WEEKLY_BRIEFING.md — primary customer communication / HoM check-in
- HEAD_OF_MARKETING_JOURNAL.md — narrative window into HoM work (not an audit log)
- MONTHLY_FOCUS.md — living “what we’re working toward this month” (not a traditional plan)
- GREAT_SIMPLIFICATION.md — navigation/IA simplification sprint (presentation only)
- PROACTIVE_HEAD_OF_MARKETING.md — proactive presence + richer activity timeline (presentation only)
- PRODUCT_READINESS.md — polish sprint: copy, a11y, loading, motion, walkthrough (presentation only)
- MARKETING_DIRECTOR_ARCHITECTURE.md — decision-pipeline architecture review + orchestration design (analysis only)
- MARKETING_DIRECTOR_FOUNDATION.md — shared decision composition layer consolidating duplicate primary-decision authority (orchestration only)
- MARKETING_MEMORY_ARCHITECTURE.md — Marketing Memory review + design: observations/learnings/preferences/decisions/outcomes layers feeding the Marketing Director (analysis; Phases 1-2 now implemented, see MARKETING_MEMORY_FOUNDATION.md / MARKETING_MEMORY_LEARNINGS.md)
- MARKETING_MEMORY_DATA_MODEL.md — field-level schema for Marketing Memory entities (Phase 1-2 entities implemented; Phases 3-4 remain proposals)
- MARKETING_MEMORY_FOUNDATION.md — Phase 1 implementation record: observation/context-snapshot/evidence-link tables, ingestion hooks, retention, RLS, testing (observation and evidence foundation only)
- MARKETING_MEMORY_LEARNINGS.md — Phase 2 implementation record: learnings/confidence model, cohort and baseline rules, correlation safeguards, reconciliation, RLS, testing (no Marketing Director or customer-facing consumption yet)
