/**
 * Customer Voice Health — presentation states for Marketing Health surfaces.
 * Never fabricates trends; uses existing Customer Voice Score / empty states.
 */

import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import { VoiceMaturityLabels } from "@/lib/customer-voice/types";

export const CustomerVoiceHealthStates = {
  HEALTHY: "healthy",
  EMERGING_CONCERNS: "emerging_concerns",
  LIMITED_FEEDBACK: "limited_feedback",
  ESTABLISHING_BASELINE: "establishing_baseline",
} as const;

export type CustomerVoiceHealthState =
  (typeof CustomerVoiceHealthStates)[keyof typeof CustomerVoiceHealthStates];

export type CustomerVoiceHealth = {
  state: CustomerVoiceHealthState;
  label: string;
  message: string;
  reason: string;
};

const LABELS: Record<CustomerVoiceHealthState, string> = {
  healthy: "Healthy",
  emerging_concerns: "Emerging Concerns",
  limited_feedback: "Limited Feedback",
  establishing_baseline: "Establishing Baseline",
};

export function resolveCustomerVoiceHealth(
  intelligence: CustomerVoiceIntelligence | null | undefined,
): CustomerVoiceHealth {
  if (!intelligence || intelligence.emptyState === "no_evidence") {
    return {
      state: CustomerVoiceHealthStates.ESTABLISHING_BASELINE,
      label: LABELS.establishing_baseline,
      message: "I'm still learning how customers talk about your business.",
      reason: "No Customer Voice evidence is available yet.",
    };
  }

  if (
    intelligence.emptyState === "insufficient_evidence" ||
    intelligence.score.maturityLabel === VoiceMaturityLabels.CONTINUING_TO_LEARN ||
    intelligence.score.maturityLabel === VoiceMaturityLabels.EMPTY
  ) {
    return {
      state: CustomerVoiceHealthStates.ESTABLISHING_BASELINE,
      label: LABELS.establishing_baseline,
      message: "The advisor is continuing to learn from customer feedback.",
      reason: `${intelligence.evidenceCount} review signal${intelligence.evidenceCount === 1 ? "" : "s"} so far — not enough for firm trends.`,
    };
  }

  const highImpactConcerns = intelligence.concerns.filter(
    (c) => c.businessImpact === "high" && c.evidenceCount >= 2 && c.confidence !== "low",
  );

  if (highImpactConcerns.length > 0) {
    return {
      state: CustomerVoiceHealthStates.EMERGING_CONCERNS,
      label: LABELS.emerging_concerns,
      message: "A few customer themes need a closer look.",
      reason: highImpactConcerns
        .slice(0, 2)
        .map((c) => c.label)
        .join("; "),
    };
  }

  if (intelligence.score.maturityLabel === VoiceMaturityLabels.LIMITED) {
    return {
      state: CustomerVoiceHealthStates.LIMITED_FEEDBACK,
      label: LABELS.limited_feedback,
      message: "Customer feedback is still limited.",
      reason: "Themes exist, but coverage is still building.",
    };
  }

  return {
    state: CustomerVoiceHealthStates.HEALTHY,
    label: LABELS.healthy,
    message: "Customer feedback is well established.",
    reason: "Recurring themes look consistent enough to rely on thoughtfully.",
  };
}
