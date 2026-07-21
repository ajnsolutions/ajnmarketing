/**
 * Customer-facing setup status labels — never expose raw enums.
 */

import {
  SetupOverallStatuses,
  SetupStepStatuses,
  type SetupOverallStatus,
  type SetupStepStatus,
} from "@/lib/customer-setup/types";
import type { CustomerStatusPresentation } from "@/lib/customer-ux/statusVocabulary";

const STEP_STATUS: Record<SetupStepStatus, CustomerStatusPresentation> = {
  [SetupStepStatuses.NOT_STARTED]: {
    label: "Not started",
    description: "This step has not been started yet.",
    tone: "muted",
  },
  [SetupStepStatuses.IN_PROGRESS]: {
    label: "In progress",
    description: "This step is partially complete.",
    tone: "info",
  },
  [SetupStepStatuses.READY_TO_REVIEW]: {
    label: "Ready to review",
    description: "This step is ready for your review.",
    tone: "info",
  },
  [SetupStepStatuses.COMPLETE]: {
    label: "Complete",
    description: "This step is complete.",
    tone: "success",
  },
  [SetupStepStatuses.OPTIONAL]: {
    label: "Optional",
    description: "Optional — you can do this later.",
    tone: "neutral",
  },
  [SetupStepStatuses.SKIPPED]: {
    label: "Skipped",
    description: "You skipped this optional step for now.",
    tone: "muted",
  },
  [SetupStepStatuses.BLOCKED]: {
    label: "Blocked",
    description: "Another step must be completed first.",
    tone: "warning",
  },
  [SetupStepStatuses.NEEDS_ATTENTION]: {
    label: "Needs attention",
    description: "Something needs your attention here.",
    tone: "danger",
  },
  [SetupStepStatuses.TEMPORARILY_UNAVAILABLE]: {
    label: "Temporarily unavailable",
    description: "This step is temporarily unavailable.",
    tone: "warning",
  },
};

const OVERALL: Record<SetupOverallStatus, CustomerStatusPresentation> = {
  [SetupOverallStatuses.NOT_STARTED]: {
    label: "Not started",
    description: "Setup has not started yet.",
    tone: "muted",
  },
  [SetupOverallStatuses.IN_PROGRESS]: {
    label: "In progress",
    description: "Required setup is underway.",
    tone: "info",
  },
  [SetupOverallStatuses.READY_FOR_HOM]: {
    label: "Ready for Head of Marketing",
    description: "Enough setup is complete to use Head of Marketing.",
    tone: "success",
  },
  [SetupOverallStatuses.COMPLETE]: {
    label: "Setup complete",
    description: "Required setup is complete.",
    tone: "success",
  },
  [SetupOverallStatuses.NEEDS_ATTENTION]: {
    label: "Needs attention",
    description: "A required setup item needs attention.",
    tone: "danger",
  },
};

export function setupStepStatusPresentation(
  status: SetupStepStatus,
): CustomerStatusPresentation {
  return STEP_STATUS[status];
}

export function setupOverallStatusPresentation(
  status: SetupOverallStatus,
): CustomerStatusPresentation {
  return OVERALL[status];
}
