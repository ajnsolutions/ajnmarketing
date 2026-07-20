import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /api/experiments returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/experiments");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Unauthorized/i);
});

test("unauthenticated /api/experiment-proposals/[id] approve returns unauthorized JSON", async ({ request }) => {
  const response = await request.post("/api/experiment-proposals/nonexistent-id");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Unauthorized/i);
});

test("unauthenticated admin trigger route rejects without admin session", async ({ request }) => {
  const response = await request.post("/api/admin/trigger-experiment-proposal-evaluation", {
    data: { userId: "x", businessProfileId: "y" },
  });
  expect([401, 403]).toContain(response.status());
});

test("Experimentation Engine ships on Head of Marketing with proposal-approval UI and cron gate", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("ExperimentsSection");
  expect(pageSource).toContain("pendingProposals");
  expect(pageSource).toContain("CampaignsSection");

  const section = readFileSync(
    join(process.cwd(), "components/dashboard/experiments-section.tsx"),
    "utf8",
  );
  expect(section).toContain("Marketing experiments");
  expect(section).toContain("Proposed");
  expect(section).toContain("Active");
  expect(section).toContain("Completed");
  expect(section).toContain("Approve experiment");
  expect(section).toContain("Show variants");
  expect(section).toContain("aria-expanded");
  expect(section).toContain("aria-labelledby");
  expect(section).toContain("aria-busy");
  expect(section).toContain("hom-focusable");
  // Honest completed-without-attribution state, never a winner badge.
  expect(section).toContain("Inconclusive");
  expect(section).toContain("Variant attribution unavailable");
  expect(section).toContain("No winner selected");
  expect(section).not.toMatch(/contentEditable|onChange=\{.*experiment/i);
  // No free-form creation control of any kind, and no editing of proposal fields.
  expect(section).not.toMatch(/type="text"|<input|<textarea/i);

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const templates = readFileSync(
    join(process.cwd(), "lib/marketing-experimentation/experiment-templates.ts"),
    "utf8",
  );
  expect(templates).toContain("posting_time");
  expect(templates).toContain("review_request_timing");
  expect(templates).toContain("supported: false");
  expect(templates).not.toMatch(/openai|generateRecommendation/i);

  const engine = readFileSync(
    join(process.cwd(), "lib/marketing-experimentation/experiment-engine.ts"),
    "utf8",
  );
  expect(engine).toContain("explainExperiment");
  expect(engine).not.toMatch(/fetch\(|openai|anthropic/i);

  const md = readFileSync(join(process.cwd(), "lib/marketing-director/resolveDecision.ts"), "utf8");
  expect(md).toContain("resolveMarketingDirectorDecision");

  // The client-decision-key creation route no longer exists.
  const experimentsRoute = readFileSync(
    join(process.cwd(), "app/api/experiments/route.ts"),
    "utf8",
  );
  expect(experimentsRoute).not.toContain("marketingDirectorDecisionKey");
  expect(experimentsRoute).not.toMatch(/export async function POST/);

  const proposalRoute = readFileSync(
    join(process.cwd(), "app/api/experiment-proposals/[id]/route.ts"),
    "utf8",
  );
  expect(proposalRoute).toContain("approveExperimentProposalForUser");

  const adminRoute = readFileSync(
    join(process.cwd(), "app/api/admin/trigger-experiment-proposal-evaluation/route.ts"),
    "utf8",
  );
  expect(adminRoute).toContain("requireAdminUser");
  expect(adminRoute).toContain("createServiceRoleClient");
});
