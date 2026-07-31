/**
 * Pure composition — no I/O, no new evidence. Turns an already-built Weekly
 * Growth Plan, Executive Brief, and the Opportunity Detection Engine's
 * already-persisted active opportunities into one ExecutiveReview. Every
 * sentence traces back to a field one of those systems already computed.
 */

import type { WeeklyGrowthPlan } from "@/lib/growth-planner/types";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { SUPPORTING_ACTION_LABELS, type SupportingActionKind } from "@/lib/growth-planner/types";
import {
  ExecutiveReviewCadences,
  type ActionPlan,
  type ActionPlanStep,
  type DecisionExplanation,
  type ExecutiveReview,
  type ExecutiveReviewCadence,
  type ExecutiveSummaryView,
  type PrimaryPriority,
  type SecondaryPriority,
  type TrustLink,
} from "@/lib/head-of-marketing-orchestrator/types";

/** Only a genuinely evidenced opportunity is worth naming as a secondary
 * priority (Part 3) — a thin, low-scoring one stays hidden rather than
 * padding the list. Lower than the Weekly Growth Plan's own 60-point bar
 * for *driving* the primary objective, since a secondary item only needs to
 * be worth watching, not worth reprioritizing the week around. */
const MIN_SECONDARY_OPPORTUNITY_SCORE = 40;
const MAX_SECONDARY_PRIORITIES = 3;

/** Opportunity urgency is tiered at 35/65/100 (low/medium/high) — see
 * lib/opportunity-engine/score.ts. 65+ means "medium" urgency or higher. */
const URGENT_THRESHOLD = 65;

const SUPPORTING_ACTION_HREFS: Record<SupportingActionKind, string> = {
  google_business_post: "/dashboard/google-business-profile",
  website_update: "/dashboard/website-analysis",
  email_campaign: "/dashboard/marketing-recommendations",
  social_content: "/dashboard/content/generator",
  landing_page_refresh: "/dashboard/website-analysis",
  review_request_campaign: "/dashboard/reviews",
  photo_update: "/dashboard/google-business-profile",
  business_info_update: "/dashboard/google-business-profile",
};

/** Every recommendation must link back to real evidence (Part 9) — reuses
 * the Business Brain Inspector's own section anchors rather than inventing
 * a new evidence surface. */
export const EXECUTIVE_REVIEW_TRUST_LINKS: TrustLink[] = [
  { label: "Business Brain Inspector", href: "/dashboard/business-brain" },
  { label: "Marketing Opportunities", href: "/dashboard/business-brain#section-marketing_opportunities" },
  { label: "Learning History", href: "/dashboard/business-brain#section-learning_history" },
  { label: "Customer Voice", href: "/dashboard/business-brain#section-customer_themes" },
  { label: "Search evidence", href: "/dashboard/business-brain#section-search_trends" },
];

function wonBecauseText(
  topOpportunity: DetectedOpportunity | null,
  otherActiveOpportunities: DetectedOpportunity[],
): string {
  if (!topOpportunity) {
    return "No single opportunity had strong enough evidence yet, so this priority comes directly from your stated goals and current plan.";
  }
  if (otherActiveOpportunities.length === 0) {
    return "It's the only active opportunity with strong enough evidence right now.";
  }

  const runnerUp = otherActiveOpportunities[0]!;
  const reasons: string[] = [];
  if (topOpportunity.score.evidenceStrength > runnerUp.score.evidenceStrength) reasons.push("stronger evidence");
  if (topOpportunity.score.urgency > runnerUp.score.urgency) reasons.push("more urgency");
  if (topOpportunity.score.businessImpact > runnerUp.score.businessImpact) reasons.push("bigger expected impact");
  const reason = reasons.length > 0 ? reasons.slice(0, 2).join(" and ") : "an overall stronger case";

  return `It was chosen over ${otherActiveOpportunities.length} other active opportunit${otherActiveOpportunities.length === 1 ? "y" : "ies"} because it has ${reason} right now.`;
}

function riskOfWaitingText(topOpportunity: DetectedOpportunity | null): string {
  if (!topOpportunity) {
    return "This is a steady, ongoing priority rather than a time-sensitive one — waiting a little won't lose evidence, but it also won't move on its own.";
  }
  if (topOpportunity.score.urgency >= URGENT_THRESHOLD) {
    return `Waiting risks losing the current window: ${topOpportunity.whyNow}`;
  }
  return `There's no immediate deadline, but the evidence behind it may fade if left unaddressed too long: ${topOpportunity.whyNow}`;
}

function buildPrimaryPriority(
  plan: WeeklyGrowthPlan,
  topOpportunity: DetectedOpportunity | null,
  otherActiveOpportunities: DetectedOpportunity[],
): PrimaryPriority {
  return {
    id: plan.id,
    title: plan.primaryObjective.label,
    whyNow: plan.whyNow,
    expectedImpact: plan.expectedImpact,
    estimatedEffort: plan.estimatedEffort,
    riskOfWaiting: riskOfWaitingText(topOpportunity),
    wonBecause: wonBecauseText(topOpportunity, otherActiveOpportunities),
    confidenceLabel: plan.explainability.confidenceLabelText,
    evidence: plan.evidence,
  };
}

/** At most 3, and only the ones that clear a real evidence bar (Part 3) —
 * everything below that bar simply never renders, rather than showing up
 * deprioritized. */
function buildSecondaryPriorities(
  primaryOpportunityId: string | null,
  activeOpportunities: DetectedOpportunity[],
): SecondaryPriority[] {
  return activeOpportunities
    .filter((o) => o.id !== primaryOpportunityId && o.score.total >= MIN_SECONDARY_OPPORTUNITY_SCORE)
    .slice(0, MAX_SECONDARY_PRIORITIES)
    .map((o) => ({
      id: o.id,
      title: o.statement,
      whyItMatters: o.whyNow,
      confidence: o.confidence,
    }));
}

function buildExecutiveSummary(
  executiveBrief: ExecutiveBrief,
  hiddenOpportunityCount: number,
): ExecutiveSummaryView {
  return {
    whatImproved: executiveBrief.wins.map((w) => w.text),
    whatChanged: executiveBrief.recentChanges.map((c) => c.text),
    whatNeedsAttention: executiveBrief.watchItems.map((w) => w.text),
    whatCanWait:
      hiddenOpportunityCount > 0
        ? [
            `${hiddenOpportunityCount} other opportunit${hiddenOpportunityCount === 1 ? "y is" : "ies are"} being tracked but don't need attention yet.`,
          ]
        : ["Nothing else is waiting on you right now."],
  };
}

function buildDecisionExplanation(plan: WeeklyGrowthPlan): DecisionExplanation {
  const signalsConsidered = [
    ...new Set(plan.evidence.map((e) => SIGNAL_LABELS[e.source] ?? e.source)),
  ];
  return {
    signalsConsidered,
    evidenceUsed: plan.evidence,
    learningApplied: plan.historicalContext,
    confidence: plan.explainability.confidenceLabelText ?? "Not confident enough yet to quantify.",
  };
}

const SIGNAL_LABELS: Record<string, string> = {
  business_discovery: "Business Discovery",
  goals: "Your stated goals",
  customer_voice: "Customer Voice",
  external_intelligence: "Search Console & External Intelligence",
  weekly_briefing: "This week's briefing",
  smart_uploads: "Smart Uploads",
  business_reasoning: "Business Knowledge Graph",
  business_learning_engine: "Business Learning Engine",
  opportunity_engine: "Opportunity Detection Engine",
};

function buildActionPlan(plan: WeeklyGrowthPlan): ActionPlan {
  const steps: ActionPlanStep[] = plan.supportingActions.map((action) => ({
    id: action.id,
    title: SUPPORTING_ACTION_LABELS[action.kind],
    detail: action.detail,
    href: SUPPORTING_ACTION_HREFS[action.kind] ?? null,
    certainty: action.certainty,
  }));

  return {
    steps,
    successMetric: `${plan.successMetric.label}: ${plan.successMetric.detail}`,
    whatIllWatch: plan.whatIllWatch.map((signal) => `${signal.label}: ${signal.detail}`),
  };
}

export function buildExecutiveReview(input: {
  businessName: string;
  plan: WeeklyGrowthPlan;
  executiveBrief: ExecutiveBrief;
  topOpportunity?: DetectedOpportunity | null;
  activeOpportunities?: DetectedOpportunity[];
  now?: Date;
}): ExecutiveReview {
  const now = input.now ?? new Date();
  const topOpportunity = input.topOpportunity ?? null;
  const activeOpportunities = input.activeOpportunities ?? [];
  const otherActiveOpportunities = topOpportunity
    ? activeOpportunities.filter((o) => o.id !== topOpportunity.id)
    : activeOpportunities;

  const secondaryPriorities = buildSecondaryPriorities(topOpportunity?.id ?? null, activeOpportunities);
  const hiddenCount = Math.max(
    0,
    otherActiveOpportunities.filter((o) => o.score.total >= MIN_SECONDARY_OPPORTUNITY_SCORE).length -
      secondaryPriorities.length,
  );

  return {
    generatedAt: now.toISOString(),
    businessName: input.businessName,
    cadence: ExecutiveReviewCadences.TODAY,
    headline: input.executiveBrief.headline,
    summary: input.executiveBrief.summary,
    primaryPriority: buildPrimaryPriority(input.plan, topOpportunity, otherActiveOpportunities),
    secondaryPriorities,
    executiveSummary: buildExecutiveSummary(input.executiveBrief, hiddenCount),
    decisionExplanation: buildDecisionExplanation(input.plan),
    actionPlan: buildActionPlan(input.plan),
    trustLinks: EXECUTIVE_REVIEW_TRUST_LINKS,
  };
}

/**
 * Today / This Week / This Month (Part 7) — the SAME ExecutiveReview core,
 * with only the headline/summary framing swapped for the matching Executive
 * Brief cadence. Nothing about the primary priority, action plan, or
 * evidence changes: only the narrative framing does.
 */
export function presentExecutiveReview(
  review: ExecutiveReview,
  cadence: ExecutiveReviewCadence,
  briefsByCadence: { morning: ExecutiveBrief; weeklyStrategy: ExecutiveBrief; monthlyExecutive: ExecutiveBrief },
): ExecutiveReview {
  const brief =
    cadence === ExecutiveReviewCadences.THIS_WEEK
      ? briefsByCadence.weeklyStrategy
      : cadence === ExecutiveReviewCadences.THIS_MONTH
        ? briefsByCadence.monthlyExecutive
        : briefsByCadence.morning;

  return {
    ...review,
    cadence,
    headline: brief.headline,
    summary: brief.summary,
  };
}
