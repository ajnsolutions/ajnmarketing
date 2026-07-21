/**
 * Guided Onboarding & Setup Experience — closed vocabularies.
 * See docs/GUIDED_ONBOARDING_AND_SETUP.md.
 *
 * Setup completion for product steps is derived. Preferences only store
 * skips / acknowledgements / dismissals that cannot be inferred.
 */

export const SetupStepCategories = {
  FOUNDATION: "foundation",
  CONNECTIONS: "connections",
  STRATEGY: "strategy_readiness",
  EXECUTION: "execution_readiness",
  OPTIONAL: "optional_enhancements",
} as const;

export type SetupStepCategory =
  (typeof SetupStepCategories)[keyof typeof SetupStepCategories];

export const SetupStepKeys = {
  BUSINESS_INFO: "business_info",
  WEBSITE: "website",
  MARKETING_GOALS: "marketing_goals",
  BRAND_VOICE: "brand_voice",
  GOOGLE_BUSINESS: "google_business",
  NOTIFICATIONS: "notifications",
  AI_MARKETING_PROFILE: "ai_marketing_profile",
  MARKETING_PLAN: "marketing_plan",
  HEAD_OF_MARKETING: "head_of_marketing",
  APPROVAL_EDUCATION: "approval_education",
  PUBLISHING_EDUCATION: "publishing_education",
  CONTENT_READY: "content_ready",
  MARKETING_PREFERENCES: "marketing_preferences",
} as const;

export type SetupStepKey = (typeof SetupStepKeys)[keyof typeof SetupStepKeys];

export const SetupStepStatuses = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  READY_TO_REVIEW: "ready_to_review",
  COMPLETE: "complete",
  OPTIONAL: "optional",
  SKIPPED: "skipped",
  BLOCKED: "blocked",
  NEEDS_ATTENTION: "needs_attention",
  TEMPORARILY_UNAVAILABLE: "temporarily_unavailable",
} as const;

export type SetupStepStatus =
  (typeof SetupStepStatuses)[keyof typeof SetupStepStatuses];

export const SetupOverallStatuses = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  READY_FOR_HOM: "ready_for_head_of_marketing",
  COMPLETE: "complete",
  NEEDS_ATTENTION: "needs_attention",
} as const;

export type SetupOverallStatus =
  (typeof SetupOverallStatuses)[keyof typeof SetupOverallStatuses];

export type SetupStepDefinition = {
  key: SetupStepKey;
  category: SetupStepCategory;
  title: string;
  description: string;
  whyItMatters: string;
  required: boolean;
  canSkip: boolean;
  educationalOnly: boolean;
  adminOnly: boolean;
  affectsReadiness: boolean;
  destinationRoute: string;
  primaryActionLabel: string;
  estimatedEffort: string;
  helpText: string;
  dependencyKeys: SetupStepKey[];
  sortOrder: number;
};

export type SetupStepView = SetupStepDefinition & {
  status: SetupStepStatus;
  statusReason: string;
  blockedReason: string | null;
  completionCriteria: string;
  freshnessLabel: string | null;
};

export type CustomerSetupPreferences = {
  id: string;
  user_id: string;
  business_profile_id: string;
  skipped_step_keys: SetupStepKey[];
  acknowledged_step_keys: SetupStepKey[];
  onboarding_dismissed_at: string | null;
  setup_completed_acknowledged_at: string | null;
  last_visited_step_key: SetupStepKey | null;
  created_at: string;
  updated_at: string;
};

export type CustomerSetupSnapshot = {
  businessProfileId: string;
  overallStatus: SetupOverallStatus;
  readinessExplanation: string;
  requiredComplete: number;
  requiredTotal: number;
  optionalComplete: number;
  optionalTotal: number;
  requiredPercentComplete: number;
  canEnterMainProduct: boolean;
  headOfMarketingReady: boolean;
  publishingReady: boolean;
  googleBusinessDataAvailable: boolean;
  nextStepKey: SetupStepKey | null;
  steps: SetupStepView[];
  blockedStepKeys: SetupStepKey[];
  needsAttentionStepKeys: SetupStepKey[];
  preferences: CustomerSetupPreferences | null;
  warnings: string[];
};

/** Facts gathered from existing product tables — never client-supplied completion. */
export type CustomerSetupFacts = {
  hasBusinessProfile: boolean;
  businessName: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
  noWebsiteConfirmed: boolean;
  marketingGoals: string[];
  brandVoiceTone: string | null;
  preferredWords: string | null;
  onboardingCompleted: boolean;
  gbp: {
    setupRequired: boolean;
    connected: boolean;
    connectionStatus: string | null;
    scopesValid: boolean;
    lastSyncedAt: string | null;
  };
  websiteAnalysis: {
    exists: boolean;
    status: string | null;
    failed: boolean;
  };
  aiMarketingProfileExists: boolean;
  marketingPlanExists: boolean;
  openRecommendationCount: number;
  pendingApprovalCount: number;
};
