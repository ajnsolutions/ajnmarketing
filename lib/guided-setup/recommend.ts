/**
 * One highest-value next guided step — never a wall of checklist items.
 * Prefers required setup gaps, then Business Connections recommendation.
 */

import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import { SetupStepStatuses } from "@/lib/customer-setup/types";
import type { NextConnectionRecommendation } from "@/lib/business-connections/types";
import type { GuidedMilestone, GuidedNextStep } from "@/lib/guided-setup/types";
import { MilestoneStates } from "@/lib/guided-setup/types";

export function recommendGuidedNextStep(input: {
  setup: CustomerSetupSnapshot;
  milestones: GuidedMilestone[];
  connectionRecommendation: NextConnectionRecommendation | null;
}): GuidedNextStep | null {
  const current = input.milestones.find((m) => m.state === MilestoneStates.CURRENT);
  if (current) {
    const stepKey = current.relatedSetupStepKeys[0] ?? null;
    const step = stepKey
      ? input.setup.steps.find((s) => s.key === stepKey) ?? null
      : null;
    if (step && step.status !== SetupStepStatuses.COMPLETE) {
      return {
        title: step.title,
        why: step.statusReason || current.knownSummary,
        brainImprovement: current.brainImprovement,
        href: step.destinationRoute,
        actionLabel: step.primaryActionLabel,
        source: "setup",
        setupStepKey: step.key,
        connectionId: null,
      };
    }
  }

  // Required incomplete setup steps (single).
  const requiredGap = input.setup.steps.find(
    (step) =>
      step.required &&
      step.status !== SetupStepStatuses.COMPLETE &&
      step.status !== SetupStepStatuses.SKIPPED,
  );
  if (requiredGap) {
    return {
      title: requiredGap.title,
      why: requiredGap.statusReason,
      brainImprovement: requiredGap.whyItMatters,
      href: requiredGap.destinationRoute,
      actionLabel: requiredGap.primaryActionLabel,
      source: "setup",
      setupStepKey: requiredGap.key,
      connectionId: null,
    };
  }

  // Highest-value connection when foundation is ready.
  if (input.connectionRecommendation?.href) {
    return {
      title: input.connectionRecommendation.displayName,
      why: input.connectionRecommendation.why,
      brainImprovement: input.connectionRecommendation.whatYouLearn,
      href: input.connectionRecommendation.href,
      actionLabel: "Continue",
      source: "connection",
      setupStepKey: null,
      connectionId: input.connectionRecommendation.connectionId,
    };
  }

  // Optional milestone waiting (e.g. customer feedback).
  const optional = input.milestones.find(
    (m) => m.state === MilestoneStates.OPTIONAL_WAITING,
  );
  if (optional) {
    const stepKey = optional.relatedSetupStepKeys[0] ?? null;
    const step = stepKey
      ? input.setup.steps.find((s) => s.key === stepKey) ?? null
      : null;
    if (step) {
      return {
        title: step.title,
        why: "Optional — unlocks richer insight when you're ready.",
        brainImprovement: optional.brainImprovement,
        href: step.destinationRoute,
        actionLabel: step.primaryActionLabel,
        source: "setup",
        setupStepKey: step.key,
        connectionId: null,
      };
    }
  }

  return null;
}
