import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/**
 * Task 006 — Market Radar evidence for Marketing Director recommendations.
 * Source-level wiring checks, matching this repo's established style for
 * queue-task Playwright coverage (see market-radar.spec.ts, business-pulse.spec.ts,
 * executive-briefing.spec.ts) — no new route was added, so there is no
 * redirect-behavior test; these confirm the new module exists, is actually
 * wired into both recommendation-presentation service call sites (not just
 * defined and unused), and never leaks a raw confidence value.
 */

test("competitorEvidence module exists and reuses Task 003/004's existing infrastructure, not new logic", () => {
  const evidenceModule = read("lib/recommendation-presentation/competitorEvidence.ts");
  expect(evidenceModule).toContain("buildCompetitorEvidence");
  expect(evidenceModule).toContain("buildWhatChangedItems");
  expect(evidenceModule).toContain("filterObservationsByConfidence");
  expect(evidenceModule).toContain("confidenceLabelText");
  expect(evidenceModule).toContain("confidenceExplanation");
  // Never the recommendation-flavored confidence labels — see this file's own header comment
  // and lib/competitor-observations/confidenceLabels.ts's, both explaining why.
  expect(evidenceModule).not.toContain("recommendation-presentation/confidenceLabels");
});

test("ClientRecommendationDecisionPackage carries competitorEvidence as its own dedicated, always-present field", () => {
  const types = read("lib/recommendation-presentation/types.ts");
  expect(types).toContain("ClientCompetitorEvidence");
  expect(types).toContain("competitorEvidence: ClientCompetitorEvidence[]");
});

test("both service call sites fetch real competitor observations and Market Radar entries -- not fabricated or hardcoded", () => {
  const service = read("lib/recommendation-presentation/service.ts");
  expect(service).toContain("listCompetitorObservationsForUser");
  expect(service).toContain("listMarketRadarEntriesForUser");
  expect(service).toContain("buildCompetitorEvidence");
  // Present in both getRecommendationDecisionPackageForUser and
  // getRecommendationDecisionPackagesForApprovals -- counting occurrences
  // catches a regression where only one call site got wired.
  const occurrences = (service.match(/buildCompetitorEvidence\(/g) ?? []).length;
  expect(occurrences).toBeGreaterThanOrEqual(2);
});

test("the batch call site computes competitor evidence once per business, not once per approval (no N+1)", () => {
  const service = read("lib/recommendation-presentation/service.ts");
  const batchFunctionStart = service.indexOf("getRecommendationDecisionPackagesForApprovals");
  const loopStart = service.indexOf("for (const approval of recommendationLinked)");
  const computeCallIndex = service.indexOf("buildCompetitorEvidence(competitorObservations", batchFunctionStart);
  expect(computeCallIndex).toBeGreaterThan(batchFunctionStart);
  expect(computeCallIndex).toBeLessThan(loopStart);
});

test("Approval Center renders Market Radar context only when non-empty, via the plain-language label -- never the raw confidence value", () => {
  const queue = read("components/dashboard/approval-queue.tsx");
  expect(queue).toContain("competitorEvidence.length > 0");
  expect(queue).toContain("Market Radar context");
  expect(queue).toContain("item.confidenceLabel");
  // item.confidence (the raw low/medium/high) must never be rendered directly.
  expect(queue).not.toMatch(/\{item\.confidence\}/);
});

test("never claims competitor evidence is the specific cause of a recommendation -- only presented as business-level context", () => {
  const evidenceModule = read("lib/recommendation-presentation/competitorEvidence.ts");
  expect(evidenceModule).toContain("general business-level competitive context");
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("no new migration was added for this task -- 038_competitor_observations.sql remains the highest-numbered migration", () => {
  const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  expect(migrations.at(-1)).toBe("038_competitor_observations.sql");
});
