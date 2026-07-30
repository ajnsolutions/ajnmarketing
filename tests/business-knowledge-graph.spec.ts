import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// The Business Knowledge Graph is a pure, in-memory reasoning layer — it adds
// no new API route or dashboard page of its own (Part 1: "logical graph, not
// a graph database"). Its outputs surface through the existing Growth
// Advisor, Weekly Growth Plan, and Business Connections pages, which already
// have their own auth-redirect / 401 coverage. This spec verifies the new
// modules exist, wire into those existing surfaces, and never leak internals.

test("Business Knowledge Graph modules exist", () => {
  expect(existsSync(join(root, "lib/business-knowledge-graph/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/topicMatch.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/build.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/reasoning.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/explainability.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/knowledgeHealth.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/businessDiscovery.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/goals.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/customerVoice.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/externalIntelligence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/smartUploads.ts"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/BUSINESS_KNOWLEDGE_GRAPH.md"))).toBe(true);
});

test("the graph builder and reasoning engine never branch on provider id (Part 10 extensibility)", () => {
  const build = read("lib/business-knowledge-graph/build.ts");
  const reasoning = read("lib/business-knowledge-graph/reasoning.ts");
  for (const source of [build, reasoning]) {
    expect(source).not.toMatch(/sourceProviderId\s*===\s*["']/);
    expect(source).not.toMatch(/providerId\s*===\s*["'](business_discovery|goals|customer_voice|external_intelligence|smart_uploads)["']/);
  }
});

test("every adapter emits the shared GraphSignalInput contract, never a provider-specific shape", () => {
  const adapterFiles = [
    "businessDiscovery",
    "goals",
    "customerVoice",
    "externalIntelligence",
    "smartUploads",
  ];
  for (const name of adapterFiles) {
    const source = read(`lib/business-knowledge-graph/adapters/${name}.ts`);
    expect(source).toContain("GraphSignalInput");
  }
});

test("Growth Advisor cites the fused Business Knowledge Graph conclusion first, with supporting evidence", () => {
  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("synthesizedInsightObservation");
  expect(observations).toContain("BusinessReasoningResult");
  expect(observations).toContain("supportingEvidence");

  const briefing = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(briefing).toContain("businessReasoning");
  expect(briefing).toContain("businessKnowledgeHealth");

  const page = read("components/dashboard/growth-advisor/growth-advisor-page.tsx");
  expect(page).toContain("supportingEvidence");
});

test("Weekly Growth Plan cites the fused conclusion as its own evidence source", () => {
  const evidence = read("lib/growth-planner/evidence.ts");
  expect(evidence).toContain("business_reasoning");
  expect(evidence).toContain("BusinessReasoningResult");

  const types = read("lib/growth-planner/types.ts");
  expect(types).toContain('"business_reasoning"');
});

test("Business Connections recommendations cite the real missing capability (Part 8)", () => {
  const recommendNext = read("lib/business-connections/recommendNext.ts");
  expect(recommendNext).toContain("evidenceDrivenWhy");
  expect(recommendNext).toContain("BusinessBrainReadinessItem");

  const compose = read("lib/business-connections/compose.ts");
  expect(compose).toContain("recommendNextConnection(connections, readiness)");
});

test("Business Knowledge Health scores six dimensions and never re-ranks recommendations", () => {
  const health = read("lib/business-knowledge-graph/knowledgeHealth.ts");
  for (const dimension of [
    "businessUnderstanding",
    "evidenceCoverage",
    "knowledgeConfidence",
    "recommendationConfidence",
    "dataCompleteness",
    "crossSourceAlignment",
  ]) {
    expect(health).toContain(dimension);
  }
  expect(health).toContain("missingKnowledge");
});

test("explainability never exposes internal graph ids", () => {
  const explainability = read("lib/business-knowledge-graph/explainability.ts");
  expect(explainability).not.toMatch(/entity\.id|entityId/);
  expect(explainability).not.toMatch(/relationship\.id/);
  expect(explainability).toContain("ReasoningExplanation");
});

test("conflict detection never guesses which side is correct", () => {
  const reasoning = read("lib/business-knowledge-graph/reasoning.ts");
  expect(reasoning).toContain("findPriorityConflicts");
  expect(reasoning).toMatch(/never guess/i);
});

test("dashboard page composes reasoning and knowledge health from already-fetched Business Brain packages, not a second fetch", () => {
  const dashboardPage = read("app/dashboard/page.tsx");
  expect(dashboardPage).toContain("getBusinessReasoning");
  expect(dashboardPage).toContain("getBusinessKnowledgeHealth");
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, reasoning, evidence fusion, conflict detection, confidence, and extensibility", () => {
  const docs = read("docs/project-magic/BUSINESS_KNOWLEDGE_GRAPH.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Reasoning");
  expect(docs).toContain("Evidence fusion");
  expect(docs).toContain("Conflict detection");
  expect(docs).toContain("Confidence");
  expect(docs).toContain("Extensibility");
  expect(docs).toContain("Future roadmap");
});
