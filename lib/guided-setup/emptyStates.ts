/**
 * Calm empty states — missing info is incomplete, never "broken".
 */

import type { BusinessBrainReadinessItem } from "@/lib/business-connections/types";
import type { GuidedEmptyState, GuidedMilestone } from "@/lib/guided-setup/types";
import { MilestoneStates } from "@/lib/guided-setup/types";

export function buildGuidedEmptyStates(input: {
  milestones: GuidedMilestone[];
  readiness: BusinessBrainReadinessItem[];
}): GuidedEmptyState[] {
  const states: GuidedEmptyState[] = [];

  for (const milestone of input.milestones) {
    if (
      milestone.state === MilestoneStates.COMPLETE ||
      milestone.state === MilestoneStates.UPCOMING
    ) {
      continue;
    }
    if (
      milestone.state === MilestoneStates.CURRENT ||
      milestone.state === MilestoneStates.OPTIONAL_WAITING
    ) {
      states.push({
        id: `empty_${milestone.key}`,
        whatMissing: milestone.knownSummary,
        whyItMatters: milestone.brainImprovement,
        whatImproves: `After this step, ${milestone.brainImprovement.charAt(0).toLowerCase()}${milestone.brainImprovement.slice(1)}`,
      });
    }
  }

  // Surface connection readiness gaps that aren't already covered by milestones.
  for (const item of input.readiness) {
    if (item.state === "available") continue;
    if (item.state === "coming_soon") {
      states.push({
        id: `readiness_${item.id}`,
        whatMissing: item.label,
        whyItMatters: item.detail,
        whatImproves:
          "When this connection is ready, I'll fold it into recommendations without asking you to redo setup.",
      });
      continue;
    }
    // Avoid duplicating milestone empties for customer feedback / website.
    if (
      item.id === "readiness_customer_feedback" ||
      item.id === "readiness_website_content"
    ) {
      continue;
    }
    states.push({
      id: `readiness_${item.id}`,
      whatMissing: `${item.label} isn't connected yet`,
      whyItMatters: item.detail,
      whatImproves:
        "Connecting later improves how specific my advice can be — nothing is wrong today.",
    });
  }

  // Cap — never overwhelm.
  return states.slice(0, 4);
}
