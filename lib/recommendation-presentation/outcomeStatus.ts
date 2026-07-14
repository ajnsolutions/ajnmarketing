/**
 * Plain-language lifecycle presentation, built entirely from PR #27's normalized
 * RecommendationOutcomeSummary (lifecycleStatus) -- never independently reconstructed
 * from raw content_approval/publishing_job fields. A provider/publishing failure is
 * presented as an operational issue, explicitly separated from recommendation quality,
 * per this milestone's core "provider failures are neutral" requirement carried through
 * to the client-facing surface.
 */

import type { RecommendationOutcomeSummary } from "@/lib/recommendation-outcomes/types";
import type { OutcomeStatusPresentation } from "@/lib/recommendation-presentation/types";

export function presentOutcomeStatus(summary: RecommendationOutcomeSummary): OutcomeStatusPresentation {
  switch (summary.lifecycleStatus) {
    case "rejected":
      return { label: "Rejected", isOperationalIssue: false, detail: null };
    case "approved":
      return { label: "Approved", isOperationalIssue: false, detail: null };
    case "publishing_queued":
      return { label: "Scheduled", isOperationalIssue: false, detail: null };
    case "publishing":
      return { label: "Publishing", isOperationalIssue: false, detail: null };
    case "published":
      return { label: "Published", isOperationalIssue: false, detail: null };
    case "measured":
      return { label: "Performance measured", isOperationalIssue: false, detail: null };
    case "publish_failed":
      return {
        label: "Publishing needs attention",
        isOperationalIssue: true,
        detail: "This does not affect the quality of the recommendation.",
      };
    case "awaiting_review":
      return summary.wasEdited
        ? { label: "Edited", isOperationalIssue: false, detail: null }
        : { label: "Ready for review", isOperationalIssue: false, detail: null };
    case "recommended":
    default:
      return { label: "Ready for review", isOperationalIssue: false, detail: null };
  }
}
