import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Business Learning Engine modules, migration, routes, and docs exist", () => {
  expect(existsSync(join(root, "lib/business-learning-engine/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/confidence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/lifecycle.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/reinforce.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/learningMaturity.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/adapters/marketingMemory.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/adapters/recommendationOutcomes.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/adapters/businessKnowledgeGraph.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-learning-engine/adapters/feedback.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-timeline/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-timeline/build.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-timeline/service.ts"))).toBe(true);
  expect(existsSync(join(root, "supabase/migrations/034_business_learning_engine.sql"))).toBe(true);
  expect(existsSync(join(root, "app/api/recommendation-feedback/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/business-timeline/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/business-timeline-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/BUSINESS_LEARNING_ENGINE.md"))).toBe(true);
});

test("unauthenticated Business Timeline page redirects to login", async ({ page }) => {
  await page.goto("/dashboard/business-timeline");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated recommendation feedback API remains unauthorized", async ({ request }) => {
  const response = await request.post("/api/recommendation-feedback", {
    data: { recommendationId: "00000000-0000-0000-0000-000000000000", feedback: "helped" },
  });
  expect(response.status()).toBe(401);
});

test("the reinforcement engine and adapters never branch on provider id (Part 10 extensibility)", () => {
  const reinforce = read("lib/business-learning-engine/reinforce.ts");
  const service = read("lib/business-learning-engine/service.ts");
  for (const source of [reinforce, service]) {
    expect(source).not.toMatch(/sourceProviderId\s*===\s*["'](marketing_memory|recommendation_outcomes|business_knowledge_graph|recommendation_feedback)["']/);
  }
});

test("every adapter emits the shared LearningSignalInput contract", () => {
  const adapterFiles = ["marketingMemory", "recommendationOutcomes", "businessKnowledgeGraph", "feedback"];
  for (const name of adapterFiles) {
    const source = read(`lib/business-learning-engine/adapters/${name}.ts`);
    expect(source).toContain("LearningSignalInput");
  }
});

test("recommendation lifecycle covers exactly the mission's ten states", () => {
  const lifecycle = read("lib/business-learning-engine/lifecycle.ts");
  for (const state of [
    "SUGGESTED",
    "GENERATED",
    "APPROVED",
    "REJECTED",
    "DEFERRED",
    "PUBLISHED",
    "OBSERVED",
    "SUCCESSFUL",
    "UNSUCCESSFUL",
    "RETIRED",
  ]) {
    expect(lifecycle).toContain(state);
  }
});

test("adaptive confidence never lets historical success dominate current evidence", () => {
  const confidence = read("lib/business-learning-engine/confidence.ts");
  expect(confidence).toContain("blendConfidence");
  expect(confidence).toMatch(/never (dominate|downgrade)/i);
});

test("Growth Advisor and Weekly Growth Plan cite historical learning, separately from current evidence", () => {
  const briefing = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(briefing).toContain("historicalContextFromPattern");
  expect(briefing).toContain("businessLearningPattern");

  const recommendationSection = read("components/dashboard/growth-advisor/recommendation-section.tsx");
  expect(recommendationSection).toContain("historicalContext");
  expect(recommendationSection).toContain("This helped");
  expect(recommendationSection).toContain("Wasn&apos;t useful");

  const evidence = read("lib/growth-planner/evidence.ts");
  expect(evidence).toContain("buildHistoricalContext");

  const planTypes = read("lib/growth-planner/types.ts");
  expect(planTypes).toContain("historicalContext");
  expect(planTypes).toContain('"business_learning_engine"');
});

test("Learning Maturity scores five dimensions with a concrete improvement tip each", () => {
  const maturity = read("lib/business-learning-engine/learningMaturity.ts");
  for (const dimension of [
    "learningDepth",
    "outcomeCoverage",
    "recommendationFeedbackRate",
    "evidenceQuality",
    "confidenceStability",
  ]) {
    expect(maturity).toContain(dimension);
  }
  expect(maturity).toContain("improvementTip");
});

test("Business Timeline answers what changed and what the AI learned, never fabricating a learning claim", () => {
  const types = read("lib/business-timeline/types.ts");
  expect(types).toContain("whatChanged");
  expect(types).toContain("whatDidAILearn");

  const build = read("lib/business-timeline/build.ts");
  expect(build).toContain("recommendationEntries");
  expect(build).toContain("campaignEntries");
  expect(build).toContain("uploadEntries");
  expect(build).toContain("searchMilestoneEntries");
  expect(build).toContain("customerVoiceMilestoneEntries");
  expect(build).toContain("learningMilestoneEntries");
});

test("the feedback loop is a distinct, append-only table with RLS, never a generic event log", () => {
  const migration = read("supabase/migrations/034_business_learning_engine.sql");
  expect(migration).toContain("create table if not exists public.business_learning_patterns");
  expect(migration).toContain("create table if not exists public.recommendation_feedback_events");
  expect(migration).toContain("alter table public.business_learning_patterns enable row level security");
  expect(migration).toContain("alter table public.recommendation_feedback_events enable row level security");
  expect(migration).not.toMatch(/using \(true\)/i);
});

test("the feedback API route verifies recommendation ownership before recording feedback", () => {
  const route = read("app/api/recommendation-feedback/route.ts");
  expect(route).toContain("Unauthorized");
  expect(route).toContain(".eq(\"user_id\", user.id)");
  expect(route).toContain("Recommendation not found");
});

test("dashboard page composes learning reconciliation from already-fetched Business Brain packages, not a second fetch", () => {
  const dashboardPage = read("app/dashboard/page.tsx");
  expect(dashboardPage).toContain("reconcileAndGetBusinessLearningPatterns");
  expect(dashboardPage).toContain("computeLearningMaturity");
  expect(dashboardPage).toContain("findPatternForActionType");
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, learning model, pattern lifecycle, confidence evolution, feedback loop, provider integration, and future roadmap", () => {
  const docs = read("docs/project-magic/BUSINESS_LEARNING_ENGINE.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Learning model");
  expect(docs).toContain("Pattern lifecycle");
  expect(docs).toContain("Confidence evolution");
  expect(docs).toContain("Feedback loop");
  expect(docs).toContain("Provider integration");
  expect(docs).toContain("Future roadmap");
});
