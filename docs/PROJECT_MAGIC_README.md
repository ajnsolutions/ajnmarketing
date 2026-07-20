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
- MARKETING_DIRECTOR_ARCHITECTURE.md — decision-pipeline architecture review + orchestration design (analysis; Phase 4 memory consumption now implemented)
- MARKETING_DIRECTOR_FOUNDATION.md — shared decision composition layer consolidating duplicate primary-decision authority (orchestration only)
- MARKETING_DIRECTOR_MEMORY_INTEGRATION.md — Phase 4: Marketing Director consumes Marketing Memory evidence (optional, deterministic; MD remains sole decision-maker)
- EXECUTIVE_BRIEFING_ENGINE.md — Phase 2 capability: structured Morning / Weekly / Monthly executive briefs that summarize MD + existing signals (no recommendation logic)
- CAMPAIGN_INTELLIGENCE_ENGINE.md — Phase 2B: Campaign Intelligence execution layer (MD-gated plans, timelines, metrics, HoM dashboard; observations only into Marketing Memory)
- INTERACTIVE_HEAD_OF_MARKETING.md — Phase 2C: Ask Your Head of Marketing presentation/explanation layer over MD + existing intelligence (no second recommendation engine)
- STRATEGIC_MARKETING_CALENDAR.md — Phase 2D: read-only Strategic Marketing Calendar aggregating MD / campaigns / publishing / approvals / market context
- MARKETING_EXPERIMENTATION_ENGINE.md — Phase 2E: Marketing Experimentation Engine (MD-gated experiments, lifecycle, deterministic outcomes, HoM dashboard; observations only into Marketing Memory)
- MARKETING_MEMORY_ARCHITECTURE.md — Marketing Memory review + design: observations/learnings/preferences/decisions/outcomes layers feeding the Marketing Director (Phases 1-4 consumption implemented; decision_links persistence still future)
- MARKETING_MEMORY_DATA_MODEL.md — field-level schema for Marketing Memory entities (Phases 1-3 tables implemented; decision links remain a proposal)
- MARKETING_MEMORY_FOUNDATION.md — Phase 1 implementation record: observation/context-snapshot/evidence-link tables, ingestion hooks, retention, RLS, testing (observation and evidence foundation only)
- MARKETING_MEMORY_LEARNINGS.md — Phase 2 implementation record: learnings/confidence model, cohort and baseline rules, correlation safeguards, reconciliation, RLS, testing
- MARKETING_MEMORY_PREFERENCES.md — Phase 3 implementation record: preferences/overrides, actor attribution, supersession, precedence vocabulary, minimal settings UI
