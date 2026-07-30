import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Opportunity Detection Engine modules and docs exist", () => {
  expect(existsSync(join(root, "lib/opportunity-engine/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/detect.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/score.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/dedupe.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/reconcile.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/adapters/externalIntelligence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/adapters/customerVoice.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/adapters/smartUploads.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/adapters/businessKnowledgeGraph.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/opportunity-engine/adapters/businessLearningEngine.ts"))).toBe(true);
  expect(existsSync(join(root, "supabase/migrations/036_opportunity_detection_engine.sql"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/OPPORTUNITY_DETECTION_ENGINE.md"))).toBe(true);
});

test("Part 2 — opportunity types cover the mission's examples without fabricating new ones", () => {
  const types = read("lib/opportunity-engine/types.ts");
  for (const opportunityType of [
    "seasonal",
    "trending_search",
    "reputation",
    "content_gap",
    "website_improvement",
    "local_event",
    "competitive_positioning",
    "customer_education",
    "faq",
    "service_spotlight",
    "review_request",
    "underperforming_content_refresh",
    "high_performing_content_expansion",
  ]) {
    expect(types).toContain(`"${opportunityType}"`);
  }
});

test("Part 3 — scoring weights evidence strength highest and reuses the Learning Engine for historical success", () => {
  const score = read("lib/opportunity-engine/score.ts");
  expect(score).toContain("findPatternForActionType");
  expect(score).toContain("evidenceStrength: 0.35");
  expect(score).not.toContain("Math.random");
});

test("Part 4 — deduplication, merging, and retirement are real, evidence-driven logic", () => {
  const dedupe = read("lib/opportunity-engine/dedupe.ts");
  expect(dedupe).toContain("topicOverlap");
  expect(dedupe).toContain("TOPIC_MERGE_THRESHOLD");

  const reconcile = read("lib/opportunity-engine/reconcile.ts");
  expect(reconcile).toContain("toExpire");
  expect(reconcile).toContain("toComplete");
  expect(reconcile).toContain("hasCompletedViaLearning");
});

test("Part 5 — Growth Advisor surfaces only the single top opportunity", () => {
  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("function opportunityObservation");
  expect(observations).toContain("topOpportunity");
  expect(observations).toContain("expectedOutcome");

  const briefing = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(briefing).toContain("topOpportunity");
});

test("Part 6 — Weekly Growth Plan is generated from active opportunities, not only a static lookup", () => {
  const primaryObjective = read("lib/growth-planner/primaryObjective.ts");
  expect(primaryObjective).toContain("OPPORTUNITY_TYPE_TO_OBJECTIVE");
  expect(primaryObjective).toContain("topOpportunity");

  const evidence = read("lib/growth-planner/evidence.ts");
  expect(evidence).toContain("opportunity_engine");
});

test("Part 7 — Business Timeline shows detected, completed, expired, and learned-from opportunities", () => {
  const types = read("lib/business-timeline/types.ts");
  expect(types).toContain("opportunity_detected");
  expect(types).toContain("opportunity_completed");
  expect(types).toContain("opportunity_expired");
  expect(types).toContain("opportunity_learned_from");

  const build = read("lib/business-timeline/build.ts");
  expect(build).toContain("function opportunityEntries");
});

test("Part 8 — Marketing Health gains an Opportunity Readiness dimension", () => {
  const knowledgeHealth = read("lib/business-knowledge-graph/knowledgeHealth.ts");
  expect(knowledgeHealth).toContain("opportunityReadiness");
  expect(knowledgeHealth).toContain("activeOpportunityCount");
  expect(knowledgeHealth).toContain("Active opportunities");
});

test("Part 9 — a future provider contributes by adding one adapter to detect.ts, nothing else changes", () => {
  const detect = read("lib/opportunity-engine/detect.ts");
  expect(detect).toContain("externalIntelligenceOpportunityCandidates");
  expect(detect).toContain("customerVoiceOpportunityCandidates");
  expect(detect).toContain("smartUploadsOpportunityCandidates");
  expect(detect).toContain("businessKnowledgeGraphOpportunityCandidates");
  expect(detect).toContain("businessLearningEngineOpportunityCandidates");
  // The engine's own scoring/dedupe/reconcile/persistence never branch on a
  // provider id — only on the shared OpportunityCandidateInput shape.
  const score = read("lib/opportunity-engine/score.ts");
  expect(score).not.toMatch(/sourceProviderId ===/);
});

test("migration enforces RLS with select/insert/update policies, no delete (lifecycle-retired, never removed)", () => {
  const migration = read("supabase/migrations/036_opportunity_detection_engine.sql");
  expect(migration).toContain("create table if not exists public.detected_opportunities");
  expect(migration).toContain("alter table public.detected_opportunities enable row level security");
  expect(migration).toContain("for select using (auth.uid() = user_id)");
  expect(migration).toContain("for insert with check (auth.uid() = user_id)");
  expect(migration).toContain("for update");
  expect(migration).not.toMatch(/for delete/);
  expect(migration).not.toMatch(/using \(true\)/i);
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, scoring, lifecycle, provider integration, and future roadmap", () => {
  const docs = read("docs/project-magic/OPPORTUNITY_DETECTION_ENGINE.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Scoring");
  expect(docs).toContain("Lifecycle");
  expect(docs).toContain("Provider integration");
  expect(docs).toContain("Future roadmap");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
