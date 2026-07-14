export const PilotBusinessStatuses = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type PilotBusinessStatus =
  (typeof PilotBusinessStatuses)[keyof typeof PilotBusinessStatuses];

export const PilotChecklistStageKeys = {
  BUSINESS_ONBOARDING: "business_onboarding",
  WEBSITE_ANALYSIS: "website_analysis",
  MARKETING_PROFILE: "marketing_profile",
  RECOMMENDATION_GENERATION: "recommendation_generation",
  APPROVAL_PACKAGE: "approval_package",
  EMAIL_REVIEW: "email_review",
  APPROVALS: "approvals",
  PUBLISHING: "publishing",
  ANALYTICS: "analytics",
  LEARNING_UPDATE: "learning_update",
  PILOT_SIGNOFF: "pilot_signoff",
} as const;

export type PilotChecklistStageKey =
  (typeof PilotChecklistStageKeys)[keyof typeof PilotChecklistStageKeys];

export const PILOT_CHECKLIST_STAGE_ORDER: PilotChecklistStageKey[] = [
  PilotChecklistStageKeys.BUSINESS_ONBOARDING,
  PilotChecklistStageKeys.WEBSITE_ANALYSIS,
  PilotChecklistStageKeys.MARKETING_PROFILE,
  PilotChecklistStageKeys.RECOMMENDATION_GENERATION,
  PilotChecklistStageKeys.APPROVAL_PACKAGE,
  PilotChecklistStageKeys.EMAIL_REVIEW,
  PilotChecklistStageKeys.APPROVALS,
  PilotChecklistStageKeys.PUBLISHING,
  PilotChecklistStageKeys.ANALYTICS,
  PilotChecklistStageKeys.LEARNING_UPDATE,
  PilotChecklistStageKeys.PILOT_SIGNOFF,
];

export const PilotStageStatuses = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  FAILED: "failed",
} as const;

export type PilotStageStatus = (typeof PilotStageStatuses)[keyof typeof PilotStageStatuses];

export const PilotIssueSeverities = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type PilotIssueSeverity =
  (typeof PilotIssueSeverities)[keyof typeof PilotIssueSeverities];

export const PilotIssueCategories = {
  UX: "ux",
  AI_QUALITY: "ai_quality",
  PUBLISHING: "publishing",
  OAUTH: "oauth",
  ANALYTICS: "analytics",
  RECOMMENDATION_QUALITY: "recommendation_quality",
  PERFORMANCE: "performance",
  SECURITY: "security",
  OPERATIONAL: "operational",
  DOCUMENTATION: "documentation",
} as const;

export type PilotIssueCategory =
  (typeof PilotIssueCategories)[keyof typeof PilotIssueCategories];

export const PilotIssueStatuses = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  WONT_FIX: "wont_fix",
} as const;

export type PilotIssueStatus = (typeof PilotIssueStatuses)[keyof typeof PilotIssueStatuses];

export const PilotManualActionKeys = {
  WEBSITE_ANALYSIS: "website_analysis",
  RECOMMENDATION_GENERATION: "recommendation_generation",
  WEEKLY_PACKAGE: "weekly_package",
  PUBLISHING: "publishing",
  ANALYTICS_CAPTURE: "analytics_capture",
  OUTCOME_RECONCILIATION: "outcome_reconciliation",
  HEALTH_REFRESH: "health_refresh",
} as const;

export type PilotManualActionKey =
  (typeof PilotManualActionKeys)[keyof typeof PilotManualActionKeys];

export const LaunchRecommendations = {
  NOT_READY: "Not Ready",
  PILOT_IN_PROGRESS: "Pilot In Progress",
  READY_FOR_LIMITED_PRODUCTION: "Ready For Limited Production",
  READY_FOR_SCHEDULE_ACTIVATION: "Ready For Schedule Activation",
} as const;

export type LaunchRecommendation =
  (typeof LaunchRecommendations)[keyof typeof LaunchRecommendations];

export type PilotChecklistItem = {
  stageKey: PilotChecklistStageKey;
  label: string;
  status: PilotStageStatus;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type PilotIssue = {
  id: string;
  pilotBusinessId: string | null;
  severity: PilotIssueSeverity;
  category: PilotIssueCategory;
  workflowStage: string | null;
  description: string;
  status: PilotIssueStatus;
  owner: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PilotManualActionRun = {
  id: string;
  pilotBusinessId: string;
  actionKey: PilotManualActionKey | string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: "running" | "success" | "failure" | "skipped";
  errorMessage: string | null;
};

export type PilotMetrics = {
  recommendationsCreated: number;
  recommendationsApproved: number;
  approvalRate: number;
  editRate: number;
  rejectionRate: number;
  publishSuccess: number;
  publishRetryRate: number;
  analyticsSuccess: number;
  averageApprovalTimeHours: number | null;
  averagePublishTimeHours: number | null;
  averageRecommendationConfidence: number | null;
  manualInterventions: number;
  workflowFailures: number;
};

export type PilotReadinessDimension = {
  key: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type PilotReadinessScore = {
  total: number;
  dimensions: PilotReadinessDimension[];
  launchRecommendation: LaunchRecommendation;
};

export type PilotBusinessSummary = {
  id: string;
  userId: string;
  businessProfileId: string;
  displayName: string;
  status: PilotBusinessStatus;
  startDate: string;
  currentCycle: number;
  notes: string | null;
  lastRecommendationRunAt: string | null;
  lastApprovalPackageAt: string | null;
  lastApprovalAt: string | null;
  lastPublishAt: string | null;
  lastAnalyticsCaptureAt: string | null;
  currentHealth: "healthy" | "warning" | "critical";
  outstandingIssueCount: number;
  manualActionsRemaining: number;
  completionPercentage: number;
  checklist: PilotChecklistItem[];
  metrics: PilotMetrics;
  readiness: PilotReadinessScore;
  recentManualRuns: PilotManualActionRun[];
};

export type AssistedPilotDashboardData = {
  generatedAt: string;
  scheduleGateOpen: boolean;
  pilots: PilotBusinessSummary[];
  openIssues: PilotIssue[];
  aggregateReadiness: PilotReadinessScore;
  launchRecommendation: LaunchRecommendation;
};
