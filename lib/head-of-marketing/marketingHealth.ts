import type {
  HeadOfMarketingHealth,
  MarketingHealthState,
} from "@/lib/head-of-marketing/types";

export type MarketingHealthSignals = {
  overallScore: number;
  gbpConnected: boolean;
  pendingApprovals: number;
  unansweredReviews: number;
  publishFailures: number;
  openRecommendations: number;
};

const LABELS: Record<MarketingHealthState, string> = {
  excellent: "Excellent",
  healthy: "Healthy",
  needs_attention: "Needs Attention",
  at_risk: "At Risk",
};

/**
 * Presentation-only Marketing Health v1.
 * Composes existing scores/signals — does not invent a new scoring engine.
 */
export function resolveMarketingHealth(
  signals: MarketingHealthSignals,
): HeadOfMarketingHealth {
  const state = resolveMarketingHealthState(signals);
  return {
    state,
    label: LABELS[state],
    message: messageForState(state, signals),
    reason: reasonForState(state, signals),
  };
}

export function resolveMarketingHealthState(
  signals: MarketingHealthSignals,
): MarketingHealthState {
  if (!signals.gbpConnected || signals.publishFailures > 0 || signals.overallScore < 35) {
    return "at_risk";
  }

  if (
    signals.pendingApprovals > 0 ||
    signals.unansweredReviews > 0 ||
    signals.openRecommendations > 2 ||
    signals.overallScore < 55
  ) {
    return "needs_attention";
  }

  if (signals.overallScore >= 80) {
    return "excellent";
  }

  return "healthy";
}

function messageForState(
  state: MarketingHealthState,
  signals: MarketingHealthSignals,
): string {
  switch (state) {
    case "excellent":
      return "Everything looks great.";
    case "healthy":
      return "Things look solid — here's what I'm doing next.";
    case "needs_attention":
      if (signals.pendingApprovals > 0) {
        return "One thing I'd like your opinion on.";
      }
      return "I noticed an opportunity.";
    case "at_risk":
      if (!signals.gbpConnected) {
        return "I need a quick connection so I can keep going.";
      }
      return "Visibility needs a little help — here's the plan.";
  }
}

function reasonForState(
  state: MarketingHealthState,
  signals: MarketingHealthSignals,
): string {
  switch (state) {
    case "excellent":
      return "Reputation and visibility look strong. I'll keep the weekly rhythm going.";
    case "healthy":
      return "You're in good shape. I'm focused on keeping momentum this week.";
    case "needs_attention":
      if (signals.pendingApprovals > 0) {
        return `${signals.pendingApprovals} item${signals.pendingApprovals === 1 ? "" : "s"} waiting for your review.`;
      }
      if (signals.unansweredReviews > 0) {
        return "A customer review is waiting for a reply.";
      }
      return "Here's what I'd recommend next.";
    case "at_risk":
      if (!signals.gbpConnected) {
        return "Google isn't connected yet — reconnect so I can keep your local presence updated.";
      }
      if (signals.publishFailures > 0) {
        return "Something didn't publish cleanly — I'll guide you through the fix.";
      }
      return "A few foundations still need attention before marketing can run smoothly.";
  }
}
