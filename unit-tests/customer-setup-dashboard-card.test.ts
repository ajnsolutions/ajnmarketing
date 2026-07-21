import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCustomerSetupSnapshot,
  shouldShowDashboardSetupCard,
} from "../lib/customer-setup/progress.ts";
import {
  SetupStepKeys,
  type CustomerSetupFacts,
  type CustomerSetupPreferences,
} from "../lib/customer-setup/types.ts";

function facts(overrides: Partial<CustomerSetupFacts> = {}): CustomerSetupFacts {
  return {
    hasBusinessProfile: true,
    businessName: "Harborview Dental",
    industry: null,
    city: null,
    state: null,
    websiteUrl: null,
    noWebsiteConfirmed: false,
    marketingGoals: ["More reviews"],
    brandVoiceTone: null,
    preferredWords: null,
    onboardingCompleted: true,
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

test("setup card shows while required incomplete", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      businessName: null,
      hasBusinessProfile: false,
      marketingGoals: [],
      onboardingCompleted: false,
    }),
    preferences: null,
  });
  assert.equal(shouldShowDashboardSetupCard(snapshot), true);
});

test("setup card respects soft dismiss when incomplete but not needing attention", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      businessName: null,
      hasBusinessProfile: true,
      marketingGoals: [],
      onboardingCompleted: false,
    }),
    preferences: prefs({ onboarding_dismissed_at: "2026-07-20T00:00:00.000Z" }),
  });
  assert.equal(shouldShowDashboardSetupCard(snapshot), false);
});

test("setup card returns when Google needs attention even if dismissed", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts({
      gbp: {
        setupRequired: false,
        connected: false,
        connectionStatus: "expired",
        scopesValid: false,
        lastSyncedAt: null,
      },
    }),
    preferences: prefs({ onboarding_dismissed_at: "2026-07-20T00:00:00.000Z" }),
  });
  assert.ok(snapshot.needsAttentionStepKeys.includes(SetupStepKeys.GOOGLE_BUSINESS));
  assert.equal(shouldShowDashboardSetupCard(snapshot), true);
});

test("setup card hides after required setup is complete", () => {
  const snapshot = computeCustomerSetupSnapshot({
    businessProfileId: "biz-1",
    facts: facts(),
    preferences: null,
  });
  assert.equal(snapshot.requiredComplete, snapshot.requiredTotal);
  assert.equal(shouldShowDashboardSetupCard(snapshot), false);
});
