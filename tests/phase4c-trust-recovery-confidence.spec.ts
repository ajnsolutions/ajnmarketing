import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("trust presentation helpers avoid fabrication and internals", () => {
  const source = read("lib/customer-ux/trustPresentation.ts");
  expect(source).toContain("buildSinceLastVisitItems");
  expect(source).toContain("buildTrustSignals");
  expect(source).toContain("recoveryPublishingFailed");
  expect(source).not.toContain("openai");
  expect(source).not.toContain("Trigger.dev");
});

test("HoM confidence and recovery surfaces are wired", () => {
  expect(read("components/dashboard/customer-confidence.tsx")).toContain("Since your last visit");
  expect(read("components/dashboard/head-of-marketing-page.tsx")).toContain("CustomerConfidencePanel");
  expect(read("components/dashboard/website-analysis-page.tsx")).toContain("RecoveryNotice");
  expect(read("components/dashboard/publishing-page.tsx")).toContain("recoveryPublishingFailed");
  expect(read("components/dashboard/content-generator-page.tsx")).toContain(
    "recoveryGenerationInterrupted",
  );
});

test("empty states and chrome trust primitives exist", () => {
  const states = read("components/dashboard/ui/dashboard-states.tsx");
  expect(states).toContain("Why empty");
  expect(states).toContain("Is that normal");
  const chrome = read("components/dashboard/ui/page-chrome.tsx");
  expect(chrome).toContain("SuccessNotice");
  expect(chrome).toContain("RecoveryNotice");
  expect(chrome).toContain("MilestoneNotice");
});

test("Phase 4C docs exist", () => {
  const docs = read("docs/PHASE4C_TRUST_RECOVERY_CONFIDENCE.md");
  expect(docs).toContain("Phase 4C");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
  expect(docs).toMatch(/Phase 5/i);
});
