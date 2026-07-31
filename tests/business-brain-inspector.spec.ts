import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Business Brain Inspector modules, page, route, and docs exist", () => {
  expect(existsSync(join(root, "lib/business-brain-inspector/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/confidence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/build.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/missingKnowledge.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/businessDiscovery.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/customerVoice.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/externalIntelligence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/opportunityEngine.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/goals.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-brain-inspector/adapters/businessLearningEngine.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/business-brain-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/business-brain/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/BUSINESS_BRAIN_INSPECTOR.md"))).toBe(true);
});

test("Part 1 — the page covers every knowledge section named in the mission, no debugging-page framing", () => {
  const types = read("lib/business-brain-inspector/types.ts");
  for (const section of [
    "business_identity",
    "products_services",
    "ideal_customers",
    "geographic_service_area",
    "differentiators",
    "brand_voice",
    "customer_themes",
    "search_trends",
    "seasonality",
    "marketing_opportunities",
    "business_goals",
    "learning_history",
  ]) {
    expect(types).toContain(`"${section}"`);
  }

  const page = read("components/dashboard/business-brain-page.tsx");
  expect(page).toContain("BRAIN_SECTION_ORDER");
  expect(page).toContain("What I know about your business");
});

test("Part 2 — confidence is High/Medium/Low, never a raw percentage on the page or in the shared vocabulary", () => {
  const confidenceLabels = read("lib/business-brain-inspector/types.ts");
  expect(confidenceLabels).toContain('high: "High"');
  expect(confidenceLabels).toContain('medium: "Medium"');
  expect(confidenceLabels).toContain('low: "Low"');

  const page = read("components/dashboard/business-brain-page.tsx");
  expect(page).toContain("Why this confidence");
  expect(page).not.toMatch(/\d{1,3}%/);
  expect(page).not.toMatch(/confidenceScore/);
});

test("Part 3 — every card carries source-attributed evidence, not a raw provider payload", () => {
  const types = read("lib/business-brain-inspector/types.ts");
  expect(types).toContain("sourceProviderId");
  expect(types).toContain("sourceLabel");
  expect(types).toContain("evidenceCount");

  const page = read("components/dashboard/business-brain-page.tsx");
  expect(page).toContain("Sources (");
});

test("Part 4 — missing knowledge is unified from Business Discovery and Business Knowledge Health, with an explanation, never invented", () => {
  const missingKnowledge = read("lib/business-brain-inspector/missingKnowledge.ts");
  expect(missingKnowledge).toContain("businessDiscovery?.missingInformation");
  expect(missingKnowledge).toContain("businessKnowledgeHealth?.missingKnowledge");

  const page = read("components/dashboard/business-brain-page.tsx");
  expect(page).toContain("What&apos;s still missing");
});

test("Part 5 — corrections always route to an existing settings/onboarding page, never a parallel editing system", () => {
  const missingKnowledge = read("lib/business-brain-inspector/missingKnowledge.ts");
  const businessDiscoveryAdapter = read("lib/business-brain-inspector/adapters/businessDiscovery.ts");
  const combined = missingKnowledge + businessDiscoveryAdapter;

  for (const existingRoute of [
    "/dashboard/setup/business",
    "/dashboard/setup/goals",
    "/dashboard/ai-profile",
    "/dashboard/customer-voice",
    "/dashboard/testimonials",
    "/dashboard/search-console",
    "/dashboard/smart-uploads",
  ]) {
    expect(combined).toContain(existingRoute);
  }

  // No new correction-persistence table was introduced for this feature.
  const migrationsDir = join(root, "supabase/migrations");
  expect(existsSync(migrationsDir)).toBe(true);
});

test("Part 6 — Growth Advisor recognizes its own confidence gaps and names the specific action that would help", () => {
  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("function confidenceGapObservation");
  expect(observations).toContain("I'd have higher confidence in future recommendations if you");
  expect(observations).toContain("businessKnowledgeHealth");

  const briefing = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(briefing).toContain("businessKnowledgeHealth");
});

test("Part 7 — Marketing Health links to the Business Brain for what evidence is missing", () => {
  const supportingContext = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supportingContext).toContain("/dashboard/business-brain");
  expect(supportingContext).toContain("See what evidence is missing in your Business Brain");
});

test("Part 8 — Business Timeline gains Business Brain milestones without duplicating existing per-item entries", () => {
  const types = read("lib/business-timeline/types.ts");
  expect(types).toContain("business_understanding_improved");
  expect(types).toContain("customer_voice_strengthened");
  expect(types).toContain("search_confidence_increased");
  expect(types).toContain("learning_confidence_improved");

  const build = read("lib/business-timeline/build.ts");
  expect(build).toContain("function businessUnderstandingImprovedEntries");
  expect(build).toContain("function customerVoiceStrengthenedEntries");
  expect(build).toContain("function searchConfidenceIncreasedEntry");
  expect(build).toContain("function learningConfidenceImprovedEntry");
  // Strengthened-theme milestone reuses frequentlyMentionedServices, not the
  // .strengths list the pre-existing customerVoiceMilestoneEntries already covers.
  expect(build).toContain("customerVoice.frequentlyMentionedServices.filter");

  const timelinePage = read("components/dashboard/business-timeline-page.tsx");
  expect(timelinePage).toContain("business_understanding_improved");
  expect(timelinePage).toContain("customer_voice_strengthened");
  expect(timelinePage).toContain("search_confidence_increased");
  expect(timelinePage).toContain("learning_confidence_improved");
});

test("Part 9 — a future provider only needs one new adapter; build.ts never branches on a provider id", () => {
  const build = read("lib/business-brain-inspector/build.ts");
  expect(build).toContain("businessDiscoveryKnowledgeCards");
  expect(build).toContain("customerVoiceKnowledgeCards");
  expect(build).toContain("externalIntelligenceKnowledgeCards");
  expect(build).toContain("opportunityEngineKnowledgeCards");
  expect(build).toContain("goalsKnowledgeCards");
  expect(build).toContain("businessLearningEngineKnowledgeCards");
  expect(build).not.toMatch(/sourceProviderId ===/);
});

test("the route redirects to setup when there's no business profile or snapshot yet", () => {
  const route = read("app/dashboard/business-brain/page.tsx");
  expect(route).toContain('redirect("/dashboard/setup")');
  expect(route).toContain("getBusinessBrainSnapshotForCurrentUser");
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, knowledge model, confidence model, evidence attribution, correction workflow, provider integration, and future roadmap", () => {
  const docs = read("docs/project-magic/BUSINESS_BRAIN_INSPECTOR.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Knowledge model");
  expect(docs).toContain("Confidence model");
  expect(docs).toContain("Evidence attribution");
  expect(docs).toContain("Correction workflow");
  expect(docs).toContain("Provider integration");
  expect(docs).toContain("Future roadmap");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
