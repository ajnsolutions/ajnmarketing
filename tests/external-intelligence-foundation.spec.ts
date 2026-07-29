import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("External Intelligence foundation ships architecture modules only", () => {
  expect(existsSync(join(root, "lib/business-brain/insight.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/types.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/provider.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/normalize.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/confidence.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/impact.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/score.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/compose.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/external-intelligence/service.ts"))).toBeTruthy();
  expect(existsSync(join(root, "app/dashboard/external-intelligence/page.tsx"))).toBeFalsy();
  expect(existsSync(join(root, "app/dashboard/what-im-watching/page.tsx"))).toBeFalsy();
});

test("provider interface is designed for future sources", () => {
  const types = read("lib/external-intelligence/types.ts");
  expect(types).toContain("GOOGLE_TRENDS");
  expect(types).toContain("WEATHER");
  expect(types).toContain("LOCAL_EVENTS");
  expect(types).toContain("INDUSTRY_NEWS");
  expect(types).toContain("COMPETITOR_MONITORING");
  expect(types).toContain("HOLIDAY_CALENDAR");
  expect(types).toContain("SEARCH_CONSOLE");

  const provider = read("lib/external-intelligence/provider.ts");
  expect(provider).toContain("ExternalIntelligenceProvider");
  expect(provider).toContain("fetchSignals");
});

test("BusinessInsight contract is shared and Customer Voice adapter exists", () => {
  const insight = read("lib/business-brain/insight.ts");
  expect(insight).toContain("export type BusinessInsight");
  expect(insight).toContain("possibleActions");
  expect(insight).toContain("relatedGoals");
  expect(insight).toContain("timeHorizon");

  expect(existsSync(join(root, "lib/customer-voice/toBusinessInsight.ts"))).toBeTruthy();
});

test("documentation covers architecture and extension", () => {
  const docs = read("docs/project-magic/EXTERNAL_INTELLIGENCE.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("BusinessInsight contract");
  expect(docs).toContain("Provider interface");
  expect(docs).toContain("Normalization");
  expect(docs).toContain("Confidence model");
  expect(docs).toContain("Business Impact");
  expect(docs).toContain("External Intelligence Score");
  expect(docs).toContain("Business Brain service");
  expect(docs).toContain("Extension guide");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("cron gate remains closed", () => {
  expect(read("lib/trigger/scheduleActivation.ts")).toMatch(
    /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/,
  );
});
