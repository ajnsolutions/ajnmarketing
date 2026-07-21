import assert from "node:assert/strict";
import test from "node:test";
import { computeCustomerSetupSnapshot } from "../lib/customer-setup/progress.ts";
import { listSetupStepDefinitions, isSetupStepKey } from "../lib/customer-setup/steps.ts";
import {
  SetupOverallStatuses,
  SetupStepKeys,
  SetupStepStatuses,
  type CustomerSetupFacts,
  type CustomerSetupPreferences,
} from "../lib/customer-setup/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

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

function prefs(
  overrides: Partial<CustomerSetupPreferences> = {},
): CustomerSetupPreferences {
  return {
    id: "pref-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    skipped_step_keys: [],
    acknowledged_step_keys: [],
    onboarding_dismissed_at: null,
    setup_completed_acknowledged_at: null,
    last_visited_step_key: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

test("setup step keys are unique and dependencies are valid", () => {
  const definitions = listSetupStepDefinitions();
  const keys = definitions.map((step) => step.key);
  assert.equal(new Set(keys).size, keys.length);
  const orders = definitions.map((step) => step.sortOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  for (const step of definitions) {
    assert.ok(typeof step.required === "boolean");
    for (const dependency of step.dependencyKeys) {
      assert.ok(isSetupStepKey(dependency));
      assert.ok(keys.includes(dependency));
    }
  }
});

test("brand-new business starts incomplete with stable next step", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts(),
    preferences: null,
  });
  assert.equal(snapshot.requiredComplete, 0);
  assert.ok(snapshot.requiredTotal > 0);
  assert.equal(snapshot.requiredPercentComplete, 0);
  assert.equal(snapshot.nextStepKey, SetupStepKeys.BUSINESS_INFO);
  assert.equal(snapshot.canEnterMainProduct, false);
  assert.equal(snapshot.headOfMarketingReady, false);
  assert.equal(snapshot.overallStatus, SetupOverallStatuses.NOT_STARTED);
});

test("magic audience markers satisfy marketing goals without optional penalty", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Harborview Dental",
      marketingGoals: ["Audience: Local business", "Customers: Local community"],
      onboardingCompleted: true,
    }),
    preferences: null,
  });
  const goals = snapshot.steps.find((step) => step.key === SetupStepKeys.MARKETING_GOALS);
  const hom = snapshot.steps.find((step) => step.key === SetupStepKeys.HEAD_OF_MARKETING);
  assert.equal(goals?.status, SetupStepStatuses.COMPLETE);
  assert.equal(hom?.status, SetupStepStatuses.COMPLETE);
  assert.equal(snapshot.requiredComplete, snapshot.requiredTotal);
  assert.equal(snapshot.requiredPercentComplete, 100);
  assert.ok(snapshot.optionalComplete < snapshot.optionalTotal);
});

test("optional skip does not reduce required percent", () => {
  const before = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Harborview Dental",
      marketingGoals: ["More reviews"],
      onboardingCompleted: true,
    }),
    preferences: null,
  });
  const after = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: before.businessProfileId
      ? facts({
          hasBusinessProfile: true,
          businessName: "Harborview Dental",
          marketingGoals: ["More reviews"],
          onboardingCompleted: true,
        })
      : facts(),
    preferences: prefs({ skipped_step_keys: [SetupStepKeys.GOOGLE_BUSINESS] }),
  });
  assert.equal(before.requiredPercentComplete, after.requiredPercentComplete);
  const gbp = after.steps.find((step) => step.key === SetupStepKeys.GOOGLE_BUSINESS);
  assert.equal(gbp?.status, SetupStepStatuses.SKIPPED);
});

test("Google reconnect needs attention; first-time disconnect stays optional", () => {
  const firstTime = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Harborview Dental",
      marketingGoals: ["More reviews"],
      onboardingCompleted: true,
      gbp: {
        setupRequired: false,
        connected: false,
        connectionStatus: "not_connected",
        scopesValid: true,
        lastSyncedAt: null,
      },
    }),
    preferences: null,
  });
  assert.equal(
    firstTime.steps.find((step) => step.key === SetupStepKeys.GOOGLE_BUSINESS)?.status,
    SetupStepStatuses.OPTIONAL,
  );

  const expired = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Harborview Dental",
      marketingGoals: ["More reviews"],
      onboardingCompleted: true,
      gbp: {
        setupRequired: false,
        connected: false,
        connectionStatus: "expired",
        scopesValid: false,
        lastSyncedAt: null,
      },
    }),
    preferences: null,
  });
  assert.equal(
    expired.steps.find((step) => step.key === SetupStepKeys.GOOGLE_BUSINESS)?.status,
    SetupStepStatuses.NEEDS_ATTENTION,
  );
});

test("website absent and failed analysis states are customer-safe", () => {
  const absent = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({ noWebsiteConfirmed: true }),
    preferences: null,
  });
  assert.equal(
    absent.steps.find((step) => step.key === SetupStepKeys.WEBSITE)?.status,
    SetupStepStatuses.SKIPPED,
  );

  const failed = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      websiteUrl: "https://example.com",
      websiteAnalysis: { exists: true, status: "failed", failed: true },
    }),
    preferences: null,
  });
  const website = failed.steps.find((step) => step.key === SetupStepKeys.WEBSITE);
  assert.equal(website?.status, SetupStepStatuses.NEEDS_ATTENTION);
  assert.ok(!/stack|oauth|secret|TOKEN_/i.test(website?.statusReason ?? ""));
});

test("existing mature business is complete without forcing optional steps", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Mature Co",
      industry: "HVAC",
      marketingGoals: ["More phone calls", "Audience: Local business"],
      brandVoiceTone: "Friendly",
      onboardingCompleted: true,
      gbp: {
        setupRequired: false,
        connected: true,
        connectionStatus: "connected",
        scopesValid: true,
        lastSyncedAt: "2026-07-19T00:00:00.000Z",
      },
      aiMarketingProfileExists: true,
      marketingPlanExists: true,
    }),
    preferences: null,
  });
  assert.equal(snapshot.overallStatus, SetupOverallStatuses.COMPLETE);
  assert.equal(snapshot.headOfMarketingReady, true);
  assert.equal(snapshot.canEnterMainProduct, true);
});

test("no divide-by-zero and blocked reasons stay customer-safe", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts(),
    preferences: null,
  });
  assert.ok(Number.isFinite(snapshot.requiredPercentComplete));
  for (const step of snapshot.steps) {
    if (step.blockedReason) {
      assert.ok(!/enum|sql|supabase|stack/i.test(step.blockedReason));
    }
  }
});

test("educational acknowledgement completes educational steps", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      hasBusinessProfile: true,
      businessName: "Harborview Dental",
      marketingGoals: ["More reviews"],
      onboardingCompleted: true,
    }),
    preferences: prefs({
      acknowledged_step_keys: [
        SetupStepKeys.APPROVAL_EDUCATION,
        SetupStepKeys.PUBLISHING_EDUCATION,
      ],
    }),
  });
  assert.equal(
    snapshot.steps.find((step) => step.key === SetupStepKeys.APPROVAL_EDUCATION)?.status,
    SetupStepStatuses.COMPLETE,
  );
});

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});
