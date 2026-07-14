/**
 * Client-safe presentation model for recommendation-generated drafts. See
 * docs/CLIENT_RECOMMENDATION_EXPERIENCE.md for the full design.
 *
 * This is a deliberately separate model from the admin debug breakdown
 * (lib/recommendation-learning/debug.ts) -- it never carries base/adjustment score
 * arithmetic, raw confidence percentages, or internal reason weights. Nothing in this
 * file's exported types is unsafe to send to a signed-in tenant's own browser.
 */

export const ConfidenceLabels = {
  STRONG_RECOMMENDATION: "strong_recommendation",
  GOOD_OPPORTUNITY: "good_opportunity",
  WORTH_CONSIDERING: "worth_considering",
  STILL_LEARNING: "still_learning",
} as const;

export type ConfidenceLabel = (typeof ConfidenceLabels)[keyof typeof ConfidenceLabels];

export type ClientReason = {
  text: string;
};

export type GeneratedDraftSummary = {
  contentApprovalId: string;
  title: string;
  content: string;
  contentType: string;
  version: number;
};

export const ClientRecommendationActions = {
  APPROVE: "approve",
  EDIT: "edit",
  REJECT: "reject",
  MORE_LIKE_THIS: "more_like_this",
} as const;

export type ClientRecommendationAction =
  (typeof ClientRecommendationActions)[keyof typeof ClientRecommendationActions];

/** Plain-language lifecycle label -- see lib/recommendation-presentation/outcomeStatus.ts. */
export type OutcomeStatusPresentation = {
  label: string;
  /** True only for a provider/publishing operational issue -- never for a rejected or
   * otherwise low-quality recommendation. Lets the UI style this as neutral, not bad. */
  isOperationalIssue: boolean;
  detail: string | null;
};

export type ClientRecommendationDecisionPackage = {
  recommendationId: string;
  contentApprovalId: string | null;
  title: string;
  recommendedAction: string;
  /** One-line plain-language summary of why this matters right now. */
  whyNow: string;
  /** 2-4 short, client-safe supporting reasons -- deterministic, never AI-generated. */
  supportingReasons: ClientReason[];
  expectedBenefit: string;
  confidenceLabel: ConfidenceLabel;
  confidenceLabelText: string;
  confidenceExplanation: string;
  generatedDraft: GeneratedDraftSummary | null;
  platform: string | null;
  contentType: string | null;
  approvalStatus: string | null;
  outcomeStatus: OutcomeStatusPresentation;
  clientActions: ClientRecommendationAction[];
  sourceContext: {
    urgency: string;
    categories: string[];
  };
  createdAt: string;
};
