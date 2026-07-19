/**
 * Strategic Marketing Calendar — client-safe event contracts.
 * See docs/STRATEGIC_MARKETING_CALENDAR.md.
 *
 * Read-only presentation of existing plans. Never creates recommendations,
 * campaigns, schedules, approvals, or publishes.
 */

export const StrategicCalendarViews = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
} as const;

export type StrategicCalendarView =
  (typeof StrategicCalendarViews)[keyof typeof StrategicCalendarViews];

export const StrategicCalendarSourceTypes = {
  MARKETING_DIRECTOR: "marketing_director",
  EXECUTIVE_BRIEF: "executive_brief",
  CAMPAIGN: "campaign",
  CAMPAIGN_STEP: "campaign_step",
  PUBLISHING_QUEUE: "publishing_queue",
  CONTENT_APPROVAL: "content_approval",
  MARKET_CONTEXT: "market_context",
} as const;

export type StrategicCalendarSourceType =
  (typeof StrategicCalendarSourceTypes)[keyof typeof StrategicCalendarSourceTypes];

export const StrategicCalendarCategories = {
  EXECUTIVE_PRIORITY: "executive_priority",
  CAMPAIGN: "campaign",
  CAMPAIGN_STEP: "campaign_step",
  PUBLISHING: "publishing",
  APPROVAL: "approval",
  RECOMMENDATION: "recommendation",
  REVIEW_ACTIVITY: "review_activity",
  MARKET_CONTEXT: "market_context",
  HOLIDAY: "holiday",
  LOCAL_EVENT: "local_event",
  GOOGLE_BUSINESS: "google_business",
  WEBSITE_CONTENT: "website_content",
  SOCIAL_CONTENT: "social_content",
  BLOG_CONTENT: "blog_content",
  EMAIL_CONTENT: "email_content",
} as const;

export type StrategicCalendarCategory =
  (typeof StrategicCalendarCategories)[keyof typeof StrategicCalendarCategories];

export const StrategicCalendarFilterGroups = {
  PRIORITIES: "priorities",
  CAMPAIGNS: "campaigns",
  PUBLISHING: "publishing",
  APPROVALS: "approvals",
  RECOMMENDATIONS: "recommendations",
  MARKET_CONTEXT: "market_context",
} as const;

export type StrategicCalendarFilterGroup =
  (typeof StrategicCalendarFilterGroups)[keyof typeof StrategicCalendarFilterGroups];

export const StrategicCalendarEventStatuses = {
  SCHEDULED: "scheduled",
  AWAITING_APPROVAL: "awaiting_approval",
  DRAFT: "draft",
  BLOCKED: "blocked",
  PUBLISHED: "published",
  MISSED: "missed",
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
  INFORMATIONAL: "informational",
  ACTION_REQUIRED: "action_required",
} as const;

export type StrategicCalendarEventStatus =
  (typeof StrategicCalendarEventStatuses)[keyof typeof StrategicCalendarEventStatuses];

export const StrategicCalendarPriorityLevels = {
  ACTION_REQUIRED: "action_required",
  EXECUTIVE: "executive",
  SCHEDULED: "scheduled",
  CAMPAIGN: "campaign",
  APPROVAL: "approval",
  RECOMMENDATION: "recommendation",
  INFORMATIONAL: "informational",
} as const;

export type StrategicCalendarPriorityLevel =
  (typeof StrategicCalendarPriorityLevels)[keyof typeof StrategicCalendarPriorityLevels];

export const StrategicCalendarConfidenceStates = {
  CONFIRMED: "confirmed",
  PLANNED: "planned",
  RECOMMENDED: "recommended",
  INFORMATIONAL: "informational",
} as const;

export type StrategicCalendarConfidenceState =
  (typeof StrategicCalendarConfidenceStates)[keyof typeof StrategicCalendarConfidenceStates];

/** Client-safe normalized calendar event — no internal scores or raw payloads. */
export type StrategicMarketingCalendarEvent = {
  id: string;
  businessProfileId: string;
  sourceType: StrategicCalendarSourceType;
  sourceId: string;
  category: StrategicCalendarCategory;
  title: string;
  summary: string;
  /** ISO datetime (UTC) for timed events; YYYY-MM-DD noon UTC for all-day. */
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  status: StrategicCalendarEventStatus;
  priority: StrategicCalendarPriorityLevel;
  confidenceState: StrategicCalendarConfidenceState;
  actionRequired: boolean;
  /** Existing product route for authoritative detail. */
  detailTarget: string;
  campaignId: string | null;
  recommendationId: string | null;
  /** Small client-safe extras only (labels, platform names). */
  metadata: Record<string, string | number | boolean | null>;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type StrategicCalendarSourceWarning = {
  source: StrategicCalendarSourceType;
  message: string;
};

export type StrategicMarketingCalendarResponse = {
  view: StrategicCalendarView;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  events: StrategicMarketingCalendarEvent[];
  warnings: StrategicCalendarSourceWarning[];
  pendingApprovalCount: number;
  generatedAt: string;
};

/** Compact HoM dashboard preview. */
export type StrategicCalendarPreview = {
  timezone: string;
  todayLabel: string;
  nextEvents: StrategicMarketingCalendarEvent[];
  todayActionRequired: StrategicMarketingCalendarEvent[];
  nextCampaignMilestone: StrategicMarketingCalendarEvent | null;
  pendingApprovalCount: number;
  fullCalendarHref: string;
};

/** Repository convention: business_profiles has no timezone column. */
export const DEFAULT_BUSINESS_TIMEZONE = "UTC";

export const CALENDAR_RANGE_BOUNDS = {
  dayMaxDays: 3,
  weekMaxDays: 28,
  monthMaxDays: 93,
} as const;
