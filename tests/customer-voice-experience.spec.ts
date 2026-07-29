import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Customer Voice Experience ships page and consumer wiring", () => {
  expect(existsSync(join(root, "app/dashboard/customer-voice/page.tsx"))).toBeTruthy();
  expect(existsSync(join(root, "components/dashboard/customer-voice-page.tsx"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/possibleActions.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/copySuggestions.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/health.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/presentation.ts"))).toBeTruthy();

  const page = read("components/dashboard/customer-voice-page.tsx");
  expect(page).toContain("What customers consistently love");
  expect(page).toContain("Opportunities to improve");
  expect(page).toContain("Words customers naturally use");
  expect(page).toContain("Services customers mention most");
  expect(page).toContain("Recent customer trends");
  expect(page).toContain("Suggested marketing opportunities");
  expect(page).toContain("Possible actions");
  expect(page).toContain("Why I believe this");
});

test("Growth Advisor and Content Generator consume Customer Voice", () => {
  const ga = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(ga).toContain("customerVoice");
  expect(ga).toContain("growthAdvisorCustomerVoiceLines");

  const service = read("lib/content-generator/service.ts");
  expect(service).toContain("formatCustomerVoiceForContentPrompt");
  expect(service).toContain("getCustomerVoiceIntelligence");

  const prompt = read("lib/content-generator/prompt-builder.ts");
  expect(prompt).toContain("customerVoicePromptBlock");
  expect(prompt).toContain("never keyword-stuff");
});

test("foundation modules remain intact", () => {
  expect(existsSync(join(root, "lib/customer-voice/types.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/provider.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/compose.ts"))).toBeTruthy();
  expect(existsSync(join(root, "lib/customer-voice/service.ts"))).toBeTruthy();
});

test("documentation covers experience and integrations", () => {
  const docs = read("docs/project-magic/CUSTOMER_VOICE.md");
  expect(docs).toContain("Customer-facing experience");
  expect(docs).toContain("Marketing Copy Suggestions");
  expect(docs).toContain("Possible Actions");
  expect(docs).toContain("Growth Advisor integration");
  expect(docs).toContain("Marketing Health integration");
  expect(docs).toContain("Content Generator integration");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("cron gate remains closed", () => {
  expect(read("lib/trigger/scheduleActivation.ts")).toMatch(
    /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/,
  );
});
