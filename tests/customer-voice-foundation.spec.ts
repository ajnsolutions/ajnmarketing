import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Customer Voice Phase 1 foundation modules remain available", () => {
  expect(existsSync(join(root, "lib/customer-voice/types.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/provider.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/normalize.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/themes.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/confidence.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/impact.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/score.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/compose.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/service.ts"))).toBeTruthy();
});

test("provider interface is designed for future sources", () => {
  const types = read("lib/customer-voice/types.ts");
  expect(types).toContain("FACEBOOK_REVIEWS");
  expect(types).toContain("YELP_REVIEWS");
  expect(types).toContain("CUSTOMER_SURVEYS");
  expect(types).toContain("SUPPORT_TICKETS");

  const provider = read("lib/customer-voice/provider.ts");
  expect(provider).toContain("CustomerVoiceProvider");
  expect(provider).toContain("fetchEvidence");
});

test("documentation covers architecture and extension", () => {
  const docs = read("docs/project-magic/CUSTOMER_VOICE.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Provider interface");
  expect(docs).toContain("Evidence normalization");
  expect(docs).toContain("Growth Advisor integration");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("cron gate remains closed", () => {
  expect(read("lib/trigger/scheduleActivation.ts")).toMatch(
    /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/,
  );
});
