/**
 * Source-specific normalizers → client-safe StrategicMarketingCalendarEvent.
 * Invalid / undated records are skipped (never fabricated).
 */

import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import type { ContentApproval } from "@/lib/content-approval/types";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import type { HeadOfMarketingPrimaryAction } from "@/lib/head-of-marketing/types";
import type { MarketContextItem } from "@/lib/market-context/types";
import type { PublishingQueueItem } from "@/lib/publishing-queue/types";
import { dateKeyInRange, isoInRange } from "@/lib/strategic-marketing-calendar/calendar-range";
import { allDayStartAt, isValidDateKey, zonedDateKey } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import {
  StrategicCalendarCategories,
  StrategicCalendarConfidenceStates,
  StrategicCalendarEventStatuses,
  StrategicCalendarPriorityLevels,
  StrategicCalendarSourceTypes,
  type StrategicCalendarCategory,
  type StrategicMarketingCalendarEvent,
} from "@/lib/strategic-marketing-calendar/calendar-types";

export type NormalizeRange = {
  businessProfileId: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  todayKey: string;
};

function baseEvent(
  partial: Omit<StrategicMarketingCalendarEvent, "timezone" | "metadata"> & {
    metadata?: StrategicMarketingCalendarEvent["metadata"];
  },
  timezone: string,
): StrategicMarketingCalendarEvent {
  return {
    ...partial,
    metadata: partial.metadata ?? {},
    timezone,
  };
}

function publishingCategory(platform: string): StrategicCalendarCategory {
  if (platform === "google_business_profile") {
    return StrategicCalendarCategories.GOOGLE_BUSINESS;
  }
  if (platform === "email") return StrategicCalendarCategories.EMAIL_CONTENT;
  if (platform === "facebook" || platform === "instagram" || platform === "linkedin") {
    return StrategicCalendarCategories.SOCIAL_CONTENT;
  }
  return StrategicCalendarCategories.PUBLISHING;
}

function publishingStatus(
  status: PublishingQueueItem["status"],
): StrategicMarketingCalendarEvent["status"] {
  switch (status) {
    case "scheduled":
      return StrategicCalendarEventStatuses.SCHEDULED;
    case "published":
      return StrategicCalendarEventStatuses.PUBLISHED;
    case "failed":
      return StrategicCalendarEventStatuses.BLOCKED;
    case "ready":
      return StrategicCalendarEventStatuses.AWAITING_APPROVAL;
    default:
      return StrategicCalendarEventStatuses.DRAFT;
  }
}

export function normalizePublishingItems(
  items: PublishingQueueItem[],
  range: NormalizeRange,
): StrategicMarketingCalendarEvent[] {
  const events: StrategicMarketingCalendarEvent[] = [];
  for (const item of items) {
    if (item.business_profile_id !== range.businessProfileId) continue;
    if (!item.scheduled_for) continue; // never treat unscheduled as committed
    if (!isoInRange(item.scheduled_for, range.rangeStart, range.rangeEnd, range.timezone)) {
      continue;
    }

    const isScheduled = item.status === "scheduled" || item.status === "published";
    events.push(
      baseEvent(
        {
          id: `pub:${item.id}`,
          businessProfileId: range.businessProfileId,
          sourceType: StrategicCalendarSourceTypes.PUBLISHING_QUEUE,
          sourceId: item.id,
          category: publishingCategory(item.platform),
          title: item.title || "Scheduled publish",
          summary:
            item.status === "scheduled"
              ? "Scheduled in the Publishing Queue."
              : item.status === "published"
                ? "Already published."
                : item.status === "failed"
                  ? "Publishing needs attention."
                  : "In the publishing queue.",
          startAt: item.scheduled_for,
          endAt: null,
          allDay: false,
          status: publishingStatus(item.status),
          priority: isScheduled
            ? StrategicCalendarPriorityLevels.SCHEDULED
            : StrategicCalendarPriorityLevels.ACTION_REQUIRED,
          confidenceState:
            item.status === "scheduled" || item.status === "published"
              ? StrategicCalendarConfidenceStates.CONFIRMED
              : StrategicCalendarConfidenceStates.PLANNED,
          actionRequired: item.status === "failed" || item.status === "ready",
          detailTarget: "/dashboard/publishing",
          campaignId: null,
          recommendationId: null,
          metadata: {
            platform: item.platform,
            queueStatus: item.status,
          },
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        },
        range.timezone,
      ),
    );
  }
  return events;
}

export function normalizeCampaignCards(
  campaigns: CampaignDashboardCard[],
  range: NormalizeRange,
): StrategicMarketingCalendarEvent[] {
  const events: StrategicMarketingCalendarEvent[] = [];

  for (const campaign of campaigns) {
    // Campaign span from earliest/latest timeline scheduledFor when present.
    const datedSteps = campaign.timeline.filter(
      (step) => step.scheduledFor && isValidDateKey(step.scheduledFor),
    );
    const startKeys = datedSteps.map((step) => step.scheduledFor!);
    if (startKeys.length > 0) {
      const spanStart = startKeys.reduce((a, b) => (a < b ? a : b));
      const spanEnd = startKeys.reduce((a, b) => (a > b ? a : b));
      const overlaps = !(spanEnd < range.rangeStart || spanStart > range.rangeEnd);
      if (overlaps) {
        const anchor = spanStart < range.rangeStart ? range.rangeStart : spanStart;
        events.push(
          baseEvent(
            {
              id: `camp:${campaign.id}`,
              businessProfileId: range.businessProfileId,
              sourceType: StrategicCalendarSourceTypes.CAMPAIGN,
              sourceId: campaign.id,
              category: StrategicCalendarCategories.CAMPAIGN,
              title: campaign.title,
              summary: campaign.objective,
              startAt: allDayStartAt(anchor),
              endAt: allDayStartAt(spanEnd),
              allDay: true,
              status:
                campaign.status === "in_progress"
                  ? StrategicCalendarEventStatuses.IN_PROGRESS
                  : campaign.status === "completed"
                    ? StrategicCalendarEventStatuses.COMPLETED
                    : StrategicCalendarEventStatuses.SCHEDULED,
              priority: StrategicCalendarPriorityLevels.CAMPAIGN,
              confidenceState: StrategicCalendarConfidenceStates.PLANNED,
              actionRequired: false,
              detailTarget: "/dashboard#campaigns",
              campaignId: campaign.id,
              recommendationId: null,
              metadata: {
                campaignStatus: campaign.status,
                completionPercent: campaign.completionPercent,
              },
              createdAt: allDayStartAt(spanStart),
              updatedAt: allDayStartAt(spanStart),
            },
            range.timezone,
          ),
        );
      }
    }

    for (const step of campaign.timeline) {
      if (!step.scheduledFor || !isValidDateKey(step.scheduledFor)) continue;
      if (!dateKeyInRange(step.scheduledFor, range.rangeStart, range.rangeEnd)) continue;

      const actionRequired =
        step.status === "blocked" ||
        step.status === "missed" ||
        step.status === "scheduled" ||
        step.status === "in_progress";

      events.push(
        baseEvent(
          {
            id: `campstep:${campaign.id}:${step.key}`,
            businessProfileId: range.businessProfileId,
            sourceType: StrategicCalendarSourceTypes.CAMPAIGN_STEP,
            sourceId: `${campaign.id}:${step.key}`,
            category: StrategicCalendarCategories.CAMPAIGN_STEP,
            title: step.label,
            summary: `${campaign.title} · ${step.status.replaceAll("_", " ")}`,
            startAt: allDayStartAt(step.scheduledFor),
            endAt: null,
            allDay: true,
            status:
              step.status === "completed"
                ? StrategicCalendarEventStatuses.COMPLETED
                : step.status === "blocked"
                  ? StrategicCalendarEventStatuses.BLOCKED
                  : step.status === "missed"
                    ? StrategicCalendarEventStatuses.MISSED
                    : step.status === "skipped"
                      ? StrategicCalendarEventStatuses.COMPLETED
                      : StrategicCalendarEventStatuses.SCHEDULED,
            priority: StrategicCalendarPriorityLevels.CAMPAIGN,
            confidenceState: StrategicCalendarConfidenceStates.PLANNED,
            actionRequired:
              actionRequired &&
              step.status !== "completed" &&
              step.status !== "skipped",
            detailTarget: "/dashboard#campaigns",
            campaignId: campaign.id,
            recommendationId: null,
            metadata: {
              stepKey: step.key,
              stepStatus: step.status,
              campaignTitle: campaign.title,
            },
            createdAt: allDayStartAt(step.scheduledFor),
            updatedAt: step.completedAt ?? allDayStartAt(step.scheduledFor),
          },
          range.timezone,
        ),
      );
    }
  }

  return events;
}

/**
 * Pending approvals have no due date. Surface them as action-required on today
 * when today is in range — never as scheduled commitments.
 */
export function normalizePendingApprovals(
  approvals: ContentApproval[],
  range: NormalizeRange,
): StrategicMarketingCalendarEvent[] {
  if (!dateKeyInRange(range.todayKey, range.rangeStart, range.rangeEnd)) return [];

  return approvals
    .filter(
      (approval) =>
        approval.business_profile_id === range.businessProfileId &&
        approval.status === "pending",
    )
    .map((approval) =>
      baseEvent(
        {
          id: `appr:${approval.id}`,
          businessProfileId: range.businessProfileId,
          sourceType: StrategicCalendarSourceTypes.CONTENT_APPROVAL,
          sourceId: approval.id,
          category: StrategicCalendarCategories.APPROVAL,
          title: approval.title || "Content awaiting your opinion",
          summary: "Awaiting approval — not scheduled to publish yet.",
          startAt: allDayStartAt(range.todayKey),
          endAt: null,
          allDay: true,
          status: StrategicCalendarEventStatuses.AWAITING_APPROVAL,
          priority: StrategicCalendarPriorityLevels.APPROVAL,
          confidenceState: StrategicCalendarConfidenceStates.RECOMMENDED,
          actionRequired: true,
          detailTarget: "/dashboard/approvals",
          campaignId: null,
          recommendationId: approval.marketing_recommendation_id,
          metadata: {
            contentType: approval.content_type,
            approvalStatus: approval.status,
          },
          createdAt: approval.created_at,
          updatedAt: approval.updated_at,
        },
        range.timezone,
      ),
    );
}

export function normalizeMarketContextItems(
  items: MarketContextItem[],
  range: NormalizeRange,
): StrategicMarketingCalendarEvent[] {
  const events: StrategicMarketingCalendarEvent[] = [];
  for (const item of items) {
    if (item.business_profile_id !== range.businessProfileId) continue;
    if (!isValidDateKey(item.context_date)) continue;
    if (!dateKeyInRange(item.context_date, range.rangeStart, range.rangeEnd)) continue;

    // Skip political-looking civic items that lack a clear marketing window — keep holidays/local/seasonal.
    if (item.category === "news" || item.category === "competitor") continue;

    let category: StrategicCalendarCategory = StrategicCalendarCategories.MARKET_CONTEXT;
    if (item.category === "holiday") category = StrategicCalendarCategories.HOLIDAY;
    if (item.category === "local_event") category = StrategicCalendarCategories.LOCAL_EVENT;

    events.push(
      baseEvent(
        {
          id: `ctx:${item.id}`,
          businessProfileId: range.businessProfileId,
          sourceType: StrategicCalendarSourceTypes.MARKET_CONTEXT,
          sourceId: item.id,
          category,
          title: item.title,
          summary: item.summary || "Market context — informational only, not approved work.",
          startAt: allDayStartAt(item.context_date),
          endAt: item.expires_at && isValidDateKey(item.expires_at.slice(0, 10))
            ? allDayStartAt(item.expires_at.slice(0, 10))
            : null,
          allDay: true,
          status: StrategicCalendarEventStatuses.INFORMATIONAL,
          priority: StrategicCalendarPriorityLevels.INFORMATIONAL,
          confidenceState: StrategicCalendarConfidenceStates.INFORMATIONAL,
          actionRequired: false,
          detailTarget: "/dashboard/market-context",
          campaignId: null,
          recommendationId: null,
          metadata: {
            contextCategory: item.category,
            informational: true,
          },
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        },
        range.timezone,
      ),
    );
  }
  return events;
}

export function normalizeExecutivePriorities(input: {
  primaryAction: HeadOfMarketingPrimaryAction;
  executiveBrief: ExecutiveBrief;
  range: NormalizeRange;
}): StrategicMarketingCalendarEvent[] {
  const { primaryAction, executiveBrief, range } = input;
  if (!dateKeyInRange(range.todayKey, range.rangeStart, range.rangeEnd)) return [];

  const events: StrategicMarketingCalendarEvent[] = [];

  if (primaryAction.kind !== "none") {
    events.push(
      baseEvent(
        {
          id: `md:primary:${range.todayKey}`,
          businessProfileId: range.businessProfileId,
          sourceType: StrategicCalendarSourceTypes.MARKETING_DIRECTOR,
          sourceId: `primary:${primaryAction.kind}`,
          category: StrategicCalendarCategories.EXECUTIVE_PRIORITY,
          title: primaryAction.label,
          summary: "Current Marketing Director priority for today.",
          startAt: allDayStartAt(range.todayKey),
          endAt: null,
          allDay: true,
          status: StrategicCalendarEventStatuses.ACTION_REQUIRED,
          priority: StrategicCalendarPriorityLevels.EXECUTIVE,
          confidenceState: StrategicCalendarConfidenceStates.CONFIRMED,
          actionRequired: true,
          detailTarget: primaryAction.href || "/dashboard",
          campaignId: null,
          recommendationId: null,
          metadata: {
            decisionKind: primaryAction.kind,
          },
          createdAt: executiveBrief.generatedAt,
          updatedAt: executiveBrief.generatedAt,
        },
        range.timezone,
      ),
    );
  }

  for (const [index, item] of executiveBrief.today.entries()) {
    events.push(
      baseEvent(
        {
          id: `brief:today:${index}:${range.todayKey}`,
          businessProfileId: range.businessProfileId,
          sourceType: StrategicCalendarSourceTypes.EXECUTIVE_BRIEF,
          sourceId: `today:${index}`,
          category: StrategicCalendarCategories.EXECUTIVE_PRIORITY,
          title: item.text,
          summary: executiveBrief.summary,
          startAt: allDayStartAt(range.todayKey),
          endAt: null,
          allDay: true,
          status: StrategicCalendarEventStatuses.ACTION_REQUIRED,
          priority: StrategicCalendarPriorityLevels.EXECUTIVE,
          confidenceState: StrategicCalendarConfidenceStates.CONFIRMED,
          actionRequired: true,
          detailTarget: "/dashboard",
          campaignId: null,
          recommendationId: null,
          metadata: {
            briefType: executiveBrief.briefType,
          },
          createdAt: executiveBrief.generatedAt,
          updatedAt: executiveBrief.generatedAt,
        },
        range.timezone,
      ),
    );
  }

  return events;
}

export function eventDayKey(
  event: StrategicMarketingCalendarEvent,
  timeZone: string,
): string {
  return zonedDateKey(event.startAt, timeZone);
}
