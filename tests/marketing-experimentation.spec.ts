import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /api/experiments returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/experiments");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Unauthorized/i);
});

test("Experimentation Engine ships on Head of Marketing with lifecycle UI and cron gate", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("ExperimentsSection");
  expect(pageSource).toContain("CampaignsSection");

  const section = readFileSync(
    join(process.cwd(), "components/dashboard/experiments-section.tsx"),
    "utf8",
  );
  expect(section).toContain("Marketing experiments");
  expect(section).toContain("Active");
  expect(section).toContain("Completed");
  expect(section).toContain("Show variants");
  expect(section).toContain("aria-expanded");
  expect(section).toContain("aria-labelledby");
  expect(section).toContain("hom-focusable");
  expect(section).not.toMatch(/contentEditable|onChange=\{.*experiment/i);

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
  expect(templates).not.toMatch(/openai|generateRecommendation/i);

  const engine = readFileSync(
    join(process.cwd(), "lib/marketing-experimentation/experiment-engine.ts"),
    "utf8",
  );
  expect(engine).toContain("explainExperiment");
  expect(engine).not.toMatch(/fetch\(|openai|anthropic/i);

  const md = readFileSync(join(process.cwd(), "lib/marketing-director/resolveDecision.ts"), "utf8");
  expect(md).toContain("resolveMarketingDirectorDecision");
  expect(md).not.toContain("planExperimentFromDirector");
});
