import { isContentSupportedActionType } from "@/lib/marketing-decisions/actionTypeContentMapping";
import type {
  MarketingRecommendation,
  RecommendedActionType,
  RecommendationStatus,
  RecommendationUrgency,
} from "@/lib/marketing-decisions/types";
import type { ContentApproval } from "@/lib/content-approval/types";
import type { MarketingOpportunity } from "@/lib/marketing-opportunities/types";

export type RecommendationDraftAction = "generate" | "view" | "regenerate" | "manual";

export type RecommendationListFilter = "all" | "ready" | "in_progress" | "manual";

/**
 * What the UI (and the server-side helpers below) actually read from an opportunity:
 * id, title, description, expires_at, and evidence. user_id, business_profile_id,
 * category, severity, confidence, recommended_action, status, created_at, and
 * updated_at are never used by anything downstream of buildRecommendationListItem, so
 * they're dropped here rather than serialized to the browser for no reason.
 */
export type RecommendationOpportunitySummary = {
  id: string;
  title: string;
  description: string;
  expires_at: string | null;
  evidence: Record<string, unknown>;
};

export type RecommendationListItem = {
  recommendation: MarketingRecommendation;
  opportunities: RecommendationOpportunitySummary[];
  linkedDraft: ContentApproval | null;
  hasRejectedDraft: boolean;
  contentSupported: boolean;
  draftAction: RecommendationDraftAction;
  title: string;
  earliestExpiration: string | null;
  groupingExplanation: string;
};

export type MarketingRecommendationsSummary = {
  activeCount: number;
  readyForDraftCount: number;
  inProgressCount: number;
  manualActionCount: number;
  highestPriorityTitle: string | null;
};

export type MarketingRecommendationsPageData = {
  items: RecommendationListItem[];
  summary: MarketingRecommendationsSummary;
};

const ACTION_TYPE_LABELS: Record<RecommendedActionType, string> = {
  publish_gbp_post: "Publish a Google Business Profile post",
  request_reviews: "Ask customers for reviews",
  create_seasonal_content: "Create seasonal content",
  create_timely_content: "Create timely content",
  increase_posting_frequency: "Increase posting frequency",
  update_business_info: "Update business profile details",
  upload_photos: "Upload new photos",
  refresh_website_content: "Refresh website content",
};

const MANUAL_NEXT_STEPS: Record<string, string> = {
  request_reviews:
    "Reach out to recent customers and ask for a Google review. No content draft is generated for this action.",
  increase_posting_frequency:
    "Plan a steadier posting cadence on Google Business Profile and social. Use Content or Marketing Plan when you're ready to write posts.",
  update_business_info:
    "Review and complete missing business profile fields in Settings / Google Business Profile.",
  upload_photos:
    "Add fresh photos of your work, team, or location in Google Business Profile.",
};

export function formatRecommendedActionType(actionType: RecommendedActionType): string {
  return ACTION_TYPE_LABELS[actionType] ?? actionType.replace(/_/g, " ");
}

export function formatRecommendationStatus(status: RecommendationStatus): string {
  switch (status) {
    case "open":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "dismissed":
      return "Dismissed";
    case "completed":
      return "Completed";
    case "superseded":
      return "Outdated";
    default:
      return status;
  }
}

export function formatUrgency(urgency: RecommendationUrgency): string {
  switch (urgency) {
    case "critical":
      return "Urgent";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return urgency;
  }
}

export function formatEffort(effort: string): string {
  switch (effort) {
    case "low":
      return "Quick";
    case "medium":
      return "Moderate effort";
    case "high":
      return "More effort";
    default:
      return effort;
  }
}

export function formatImpact(impact: string): string {
  switch (impact) {
    case "high":
      return "High impact";
    case "medium":
      return "Medium impact";
    case "low":
      return "Lower impact";
    default:
      return impact;
  }
}

export function formatDraftStatus(status: ContentApproval["status"] | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending review";
    case "approved":
      return "Approved";
    case "published":
      return "Published";
    case "rejected":
      return "Rejected";
    default:
      return "No draft yet";
  }
}

export function getManualNextStep(actionType: RecommendedActionType): string {
  return (
    MANUAL_NEXT_STEPS[actionType] ??
    "This recommendation needs a manual step. It does not create a content draft automatically."
  );
}

export function buildRecommendationTitle(
  recommendation: MarketingRecommendation,
  opportunities: RecommendationOpportunitySummary[]
): string {
  const primary = opportunities[0]?.title?.trim();
  if (primary) return primary;
  return formatRecommendedActionType(recommendation.recommended_action_type);
}

export function buildGroupingExplanation(
  recommendation: MarketingRecommendation,
  opportunities: RecommendationOpportunitySummary[]
): string {
  const actionLabel = formatRecommendedActionType(recommendation.recommended_action_type);
  if (opportunities.length <= 1) {
    return `This suggestion comes from one opportunity and points to: ${actionLabel}.`;
  }
  return `We grouped ${opportunities.length} related opportunities because they all point to the same next step: ${actionLabel}.`;
}

export function earliestOpportunityExpiration(
  opportunities: RecommendationOpportunitySummary[]
): string | null {
  const dates = opportunities
    .map((item) => item.expires_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates[0] ?? null;
}

/**
 * Pure UI action resolver — Generate / View / Regenerate / Manual.
 * Active drafts always win. Rejected-only history enables regenerate.
 */
export function resolveRecommendationDraftAction(input: {
  contentSupported: boolean;
  linkedDraft: ContentApproval | null;
  hasRejectedDraft: boolean;
}): RecommendationDraftAction {
  if (!input.contentSupported) return "manual";
  if (input.linkedDraft) return "view";
  if (input.hasRejectedDraft) return "regenerate";
  return "generate";
}

export function isActiveRecommendationStatus(status: RecommendationStatus): boolean {
  return status === "open" || status === "in_progress";
}

export function buildRecommendationListItem(input: {
  recommendation: MarketingRecommendation;
  opportunities: MarketingOpportunity[];
  linkedDraft: ContentApproval | null;
  hasRejectedDraft: boolean;
}): RecommendationListItem {
  const contentSupported = isContentSupportedActionType(
    input.recommendation.recommended_action_type
  );
  const draftAction = resolveRecommendationDraftAction({
    contentSupported,
    linkedDraft: input.linkedDraft,
    hasRejectedDraft: input.hasRejectedDraft,
  });

  // Narrow to only what the UI and the helpers above actually read, before this
  // becomes part of what gets serialized to the browser.
  const opportunities: RecommendationOpportunitySummary[] = input.opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    expires_at: o.expires_at,
    evidence: o.evidence,
  }));

  return {
    recommendation: input.recommendation,
    opportunities,
    linkedDraft: input.linkedDraft,
    hasRejectedDraft: input.hasRejectedDraft,
    contentSupported,
    draftAction,
    title: buildRecommendationTitle(input.recommendation, opportunities),
    earliestExpiration: earliestOpportunityExpiration(opportunities),
    groupingExplanation: buildGroupingExplanation(input.recommendation, opportunities),
  };
}

export function buildRecommendationsSummary(
  items: RecommendationListItem[]
): MarketingRecommendationsSummary {
  const sorted = [...items].sort(
    (a, b) => b.recommendation.priority_score - a.recommendation.priority_score
  );

  return {
    activeCount: items.length,
    readyForDraftCount: items.filter((item) => item.draftAction === "generate" || item.draftAction === "regenerate")
      .length,
    inProgressCount: items.filter((item) => item.recommendation.status === "in_progress").length,
    manualActionCount: items.filter((item) => item.draftAction === "manual").length,
    highestPriorityTitle: sorted[0]?.title ?? null,
  };
}

export function filterRecommendationItems(
  items: RecommendationListItem[],
  filter: RecommendationListFilter
): RecommendationListItem[] {
  switch (filter) {
    case "ready":
      return items.filter(
        (item) => item.draftAction === "generate" || item.draftAction === "regenerate"
      );
    case "in_progress":
      return items.filter((item) => item.recommendation.status === "in_progress");
    case "manual":
      return items.filter((item) => item.draftAction === "manual");
    case "all":
    default:
      return items;
  }
}

export function formatEvidenceValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatEvidenceValue(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const formatted = formatEvidenceValue(entry);
        if (!formatted) return "";
        return `${key.replace(/_/g, " ")}: ${formatted}`;
      })
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

export function formatEvidenceEntries(
  evidence: Record<string, unknown>
): Array<{ label: string; value: string }> {
  return Object.entries(evidence)
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value: formatEvidenceValue(value),
    }))
    .filter((entry) => entry.value.trim().length > 0);
}
