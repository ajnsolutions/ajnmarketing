import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { computeCustomerSetupSnapshot } from "../lib/customer-setup/progress.ts";
import type { CustomerSetupFacts } from "../lib/customer-setup/types.ts";
import { composeBusinessConnectionsSnapshot } from "../lib/business-connections/compose.ts";
import { buildGuidedSetupExperience } from "../lib/guided-setup/buildGuidedSetupExperience.ts";
import { buildFirstWins } from "../lib/guided-setup/firstWins.ts";
import { buildGuidedEmptyStates } from "../lib/guided-setup/emptyStates.ts";
import {
  GuidedMilestoneKeys,
  KnowledgeStates,
  MilestoneStates,
} from "../lib/guided-setup/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildGrowthAdvisorBriefing } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";

const root = process.cwd();

function facts(overrides: Partial<CustomerSetupFacts> = {}): CustomerSetupFacts {
  return {
    hasBusinessProfile: false,
    businessName: null,
    industry: null,
    city: null,
    state: null,
    websiteUrl: null,
    noWebsiteConfirmed: false,
    marketingGoals: [],
    brandVoiceTone: null,
    preferredWords: null,
    onboardingCompleted: false,
    gbp: {
      setupRequired: false,
      connected: false,
      connectionStatus: null,
      scopesValid: true,
      lastSyncedAt: null,
    },
    websiteAnalysis: { exists: false, status: null, failed: false },
    aiMarketingProfileExists: false,
    marketingPlanExists: false,
    openRecommendationCount: 0,
    pendingApprovalCount: 0,
    ...overrides,
  };
}

const emptySignals = {
  gbpConnected: false,
  gbpNeedsAttention: false,
  gbpLastSyncAt: null,
  hasWebsite: false,
  websiteAnalyzed: false,
  websiteAnalyzedAt: null,
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("docs and modules ship for Guided Setup & First Wins", () => {
  assert.ok(existsSync(join(root, "docs/project-magic/GUIDED_SETUP.md")));
  assert.ok(existsSync(join(root, "lib/guided-setup/buildGuidedSetupExperience.ts")));
  assert.ok(existsSync(join(root, "components/dashboard/guided-setup-experience.tsx")));
  const docs = readFileSync(join(root, "docs/project-magic/GUIDED_SETUP.md"), "utf8");
  assert.ok(docs.includes("Setup philosophy"));
  assert.ok(docs.includes("First-win model"));
  assert.ok(docs.includes("Readiness flow"));
  assert.ok(docs.includes("Business Brain activation"));
});

test("guided setup uses milestones without percentage-complete framing", () => {
  const setup = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Acme Plumbing",
    }),
    preferences: null,
  });
  const connections = composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true });
  const experience = buildGuidedSetupExperience({
    setup,
    connections,
    businessName: "Acme Plumbing",
  });

  assert.equal(experience.milestones.length, 5);
  assert.ok(experience.milestones.some((m) => m.state === MilestoneStates.COMPLETE));
  assert.ok(experience.milestones.some((m) => m.state === MilestoneStates.CURRENT));
  assert.ok(experience.recommendedNext);
  assert.equal(experience.recommendedNext!.setupStepKey, "marketing_goals");
  assert.ok(experience.latestFirstWin);
  assert.equal(experience.latestFirstWin!.milestoneKey, GuidedMilestoneKeys.KNOW_BUSINESS);

  const ui = readFileSync(join(root, "components/dashboard/guided-setup-experience.tsx"), "utf8");
  assert.ok(ui.includes("Meaningful milestones"));
  assert.ok(ui.includes("Not a percentage bar"));
  assert.ok(!/progress bar|%\s*complete/i.test(ui));
  assert.ok(ui.includes("How this helps the Business Brain"));
});

test("readiness drives a single highest-value next step", () => {
  const setup = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Acme Plumbing",
      marketingGoals: ["Generate more leads"],
      websiteUrl: "https://acme.example",
      websiteAnalysis: { exists: true, status: "ready", failed: false },
      aiMarketingProfileExists: true,
      marketingPlanExists: true,
      onboardingCompleted: true,
    }),
    preferences: null,
  });
  const connections = composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true });
  const experience = buildGuidedSetupExperience({ setup, connections });

  assert.ok(experience.recommendedNext);
  // Foundation ready → Business Connections recommends GBP.
  assert.ok(
    experience.recommendedNext!.connectionId === "conn_google_business_profile" ||
      experience.recommendedNext!.setupStepKey === "google_business" ||
      experience.recommendedNext!.title.toLowerCase().includes("google"),
  );
});

test("first-win generation celebrates completed milestones", () => {
  const wins = buildFirstWins([
    GuidedMilestoneKeys.KNOW_BUSINESS,
    GuidedMilestoneKeys.KNOW_SUCCESS,
    GuidedMilestoneKeys.CUSTOMER_FEEDBACK,
  ]);
  assert.equal(wins.length, 3);
  assert.ok(wins.some((w) => w.valueKind === "recommendation"));
  assert.ok(wins.some((w) => w.valueKind === "marketing_plan"));
  assert.ok(wins.some((w) => w.valueKind === "customer_voice"));
  assert.ok(wins.every((w) => w.detail.length > 0 && !/\d+%/.test(w.detail)));
});

test("empty states explain missing info without implying brokenness", () => {
  const setup = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({ hasBusinessProfile: true, businessName: "Acme" }),
    preferences: null,
  });
  const connections = composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true });
  const experience = buildGuidedSetupExperience({ setup, connections });
  const empties = buildGuidedEmptyStates({
    milestones: experience.milestones,
    readiness: connections.readiness,
  });

  assert.ok(empties.length >= 1);
  for (const item of empties) {
    assert.ok(item.whatMissing.length > 0);
    assert.ok(item.whyItMatters.length > 0);
    assert.ok(item.whatImproves.length > 0);
    assert.ok(!/broken|error|failed|crash/i.test(item.whatMissing));
    assert.ok(!/broken|error|failed|crash/i.test(item.whatImproves));
  }
});

test("knowledge signals distinguish Known Learning Waiting", () => {
  const setup = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Acme Plumbing",
      marketingGoals: ["Generate more leads"],
      websiteUrl: "https://acme.example",
      websiteAnalysis: { exists: false, status: "pending", failed: false },
    }),
    preferences: null,
  });
  const experience = buildGuidedSetupExperience({
    setup,
    connections: composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true }),
  });

  const states = new Set(experience.knowledgeSignals.map((s) => s.state));
  assert.ok(states.has(KnowledgeStates.KNOWN));
  assert.ok(states.has(KnowledgeStates.WAITING) || states.has(KnowledgeStates.LEARNING));
});

test("Growth Advisor learning state recognizes guided setup progress", () => {
  const setup = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Acme Plumbing",
      marketingGoals: ["Generate more leads"],
    }),
    preferences: null,
  });
  const guidedSetup = buildGuidedSetupExperience({
    setup,
    connections: composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true }),
    businessName: "Acme Plumbing",
  });

  const baseInput: WeeklyBriefingInput = {
    userName: "Sean",
    businessName: "Acme Plumbing",
    websiteUrl: "https://acme.example",
    voiceNotes: "",
    profileCreatedAt: "2026-01-15T00:00:00.000Z",
    gbpConnected: false,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: { overall: 50, seo: 50, google: 40, reviews: 40, content: 50, consistency: 50 },
    weeklyWins: { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 },
    planSummary: null,
    marketingThemes: [],
    businessGoals: ["Generate more leads"],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: new Date("2026-07-16T09:00:00"),
  };

  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing, null, {
    goals: [],
    guidedSetup,
  });

  assert.equal(advisor.learning.isLearning, true);
  assert.ok(advisor.learning.message);
  assert.match(advisor.learning.message!, /Known|Learning|Waiting|insight/i);
});
