import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 4B — static coverage of workflow refinement surfaces.
 * Complements unit tests; avoids authenticated live dashboard dependency.
 */

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("workflow presentation module covers queue + job guides", () => {
  const source = read("lib/customer-ux/workflowPresentation.ts");
  expect(source).toContain("publishingQueueStatusGuide");
  expect(source).toContain("publishingJobStatusGuide");
  expect(source).toContain("approvalAttentionSummary");
  expect(source).toContain("LIBRARY_ZONES");
  expect(source).toContain("Failed · Retry available");
  expect(source).not.toContain("pipeline");
});

test("Approvals page answers attention + continuity", () => {
  const page = read("components/dashboard/approvals-page.tsx");
  expect(page).toContain("AttentionBanner");
  expect(page).toContain("NextStepHint");
  expect(page).toContain("FULL_CUSTOMER_JOURNEY_STEPS");
  expect(page).toContain("Needs you today");
  expect(page).toContain("View approved history");
});

test("Publishing page uses plain language and next-step continuity", () => {
  const page = read("components/dashboard/publishing-page.tsx");
  const queue = read("components/dashboard/publishing-queue-panel.tsx");
  const jobs = read("components/dashboard/publishing-jobs-panel.tsx");
  expect(page).toContain("AttentionBanner");
  expect(page).toContain("See results");
  expect(queue).toContain("Approved · Ready");
  expect(queue).toContain("What’s happening");
  expect(jobs).toContain("Live publishing activity");
  expect(jobs).not.toContain("Publishing Engine Jobs");
});

test("Library orients zones and breadcrumbs", () => {
  const page = read("components/dashboard/content-page.tsx");
  expect(page).toContain("Where things live");
  expect(page).toContain("Library breadcrumb");
  expect(page).toContain("FULL_CUSTOMER_JOURNEY_STEPS");
});

test("Results highlights wins over operational noise", () => {
  const page = read("components/dashboard/analytics-page.tsx");
  expect(page).toContain("Your marketing wins");
  expect(page).toContain("Wins worth celebrating");
  expect(page).toContain("Successful publications");
  expect(page).toContain("NextStepHint");
});

test("Phase 4B docs exist", () => {
  const docs = read("docs/PHASE4B_WORKFLOW_REFINEMENT.md");
  expect(docs).toContain("Phase 4B");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
  expect(docs).toMatch(/remaining UX backlog/i);
});
