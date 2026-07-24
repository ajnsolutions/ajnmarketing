/**
 * Phase 4C — trust, recovery, and confidence presentation helpers.
 * Pure functions over existing facts. No engines, jobs, or fabricated data.
 */

export type AwarenessState =
  | "waiting_on_you"
  | "processing"
  | "complete"
  | "up_to_date"
  | "attention_needed"
  | "all_caught_up";

export type AwarenessPresentation = {
  state: AwarenessState;
  label: string;
  detail: string;
};

export type SuccessMessage = {
  title: string;
  whatChanged: string;
  whereToFind: string;
  whatNext: string;
  href?: string;
  ctaLabel?: string;
};

export type RecoveryMessage = {
  title: string;
  whatHappened: string;
  workSafe: string;
  whatYouCanDo: string;
  whatYouCanIgnore: string;
  href?: string;
  ctaLabel?: string;
};

export type TrustSignal = {
  label: string;
  isoDate: string;
};

export type SinceLastVisitItem = {
  id: string;
  text: string;
  href?: string;
};

export type MilestoneKind =
  | "first_profile"
  | "first_marketing_plan"
  | "first_published_content"
  | "first_google_sync"
  | "first_completed_recommendation";

export type MilestonePresentation = {
  kind: MilestoneKind;
  title: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
};

const AWARENESS: Record<AwarenessState, Omit<AwarenessPresentation, "state">> = {
  waiting_on_you: {
    label: "Waiting on you",
    detail: "Something needs your opinion before we can continue.",
  },
  processing: {
    label: "Processing",
    detail: "I’m working on this — you can leave and come back.",
  },
  complete: {
    label: "Complete",
    detail: "This step finished successfully.",
  },
  up_to_date: {
    label: "Up to date",
    detail: "Nothing new here since the last refresh.",
  },
  attention_needed: {
    label: "Attention needed",
    detail: "A retry or quick decision will get things moving again.",
  },
  all_caught_up: {
    label: "All caught up",
    detail: "Nothing needs you right now.",
  },
};

export function awarenessPresentation(state: AwarenessState): AwarenessPresentation {
  return { state, ...AWARENESS[state] };
}

export function formatTrustTimestamp(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Only returns signals with real ISO timestamps — never fabricates. */
export function buildTrustSignals(
  candidates: Array<{ label: string; isoDate: string | null | undefined }>,
): TrustSignal[] {
  const signals: TrustSignal[] = [];
  for (const candidate of candidates) {
    if (!candidate.isoDate) continue;
    const date = new Date(candidate.isoDate);
    if (Number.isNaN(date.getTime())) continue;
    signals.push({ label: candidate.label, isoDate: candidate.isoDate });
  }
  return signals;
}

export function successApprovalComplete(): SuccessMessage {
  return {
    title: "Approval saved",
    whatChanged: "Your decision was recorded. Approved drafts are ready for publishing when you are.",
    whereToFind: "Find approved items in Approvals history or Publishing.",
    whatNext: "Open Publishing to send work live — approve is never the same as publish.",
    href: "/dashboard/publishing",
    ctaLabel: "Go to publishing",
  };
}

export function successGenerationComplete(count: number): SuccessMessage {
  return {
    title: count === 1 ? "Draft ready" : `${count} drafts ready`,
    whatChanged: "New draft options were generated from your business profile and brand voice.",
    whereToFind: "They’re on this page until you send one to Approvals.",
    whatNext: "Pick a draft and send it to This Week for your opinion before anything can publish.",
    href: "/dashboard/approvals",
    ctaLabel: "Open Approvals",
  };
}

export function successSentToApproval(): SuccessMessage {
  return {
    title: "Sent for your review",
    whatChanged: "This draft is now waiting in Approvals (This Week).",
    whereToFind: "Open Approvals to review it anytime.",
    whatNext: "Approve when it looks right — publishing stays a separate step.",
    href: "/dashboard/approvals",
    ctaLabel: "Review This Week",
  };
}

export function successPublishComplete(): SuccessMessage {
  return {
    title: "Published successfully",
    whatChanged: "Your update is live on the destination.",
    whereToFind: "See it in Publishing history, Library, and Results.",
    whatNext: "Check Results later for what’s improving — no action needed right now.",
    href: "/dashboard/results",
    ctaLabel: "See results",
  };
}

export function successSetupStepComplete(stepLabel: string): SuccessMessage {
  return {
    title: `${stepLabel} complete`,
    whatChanged: `I’ve recorded progress on ${stepLabel.toLowerCase()}.`,
    whereToFind: "Your setup checklist stays in Setup and under More tools on Head of Marketing.",
    whatNext: "Continue with the next incomplete setup step when you’re ready.",
    href: "/dashboard/setup",
    ctaLabel: "Open setup",
  };
}

export function recoveryPublishingFailed(): RecoveryMessage {
  return {
    title: "Publishing didn’t finish",
    whatHappened: "The update couldn’t go live on this attempt.",
    workSafe: "Your approved draft is still saved — nothing was deleted.",
    whatYouCanDo: "Retry when you’re ready, or schedule it for later.",
    whatYouCanIgnore: "Other approved items and the rest of your account are unaffected.",
    href: "/dashboard/publishing",
    ctaLabel: "Retry in publishing",
  };
}

export function recoveryWebsiteAnalysisFailed(): RecoveryMessage {
  return {
    title: "Website analysis couldn’t finish",
    whatHappened: "I couldn’t complete the scan for this URL right now.",
    workSafe: "Your existing profile and brand voice stay as they are.",
    whatYouCanDo: "Confirm the website URL, then try refreshing analysis.",
    whatYouCanIgnore: "Head of Marketing and approvals still work without a fresh scan.",
    href: "/dashboard/website-analysis",
    ctaLabel: "Try analysis again",
  };
}

export function recoveryGoogleUnavailable(): RecoveryMessage {
  return {
    title: "Google connection needs attention",
    whatHappened: "I can’t reach your Google Business Profile right now.",
    workSafe: "Drafts, approvals, and other marketing work remain available.",
    whatYouCanDo: "Reconnect when you’re ready, or keep using Head of Marketing without Google.",
    whatYouCanIgnore: "Nothing publishes while Google is unavailable.",
    href: "/dashboard/google-business-profile/connect",
    ctaLabel: "Manage Google connection",
  };
}

export function recoveryGenerationInterrupted(): RecoveryMessage {
  return {
    title: "Generation was interrupted",
    whatHappened: "I couldn’t finish creating drafts this time.",
    workSafe: "Any drafts you already sent to Approvals are still there.",
    whatYouCanDo: "Try generating again in a moment — your inputs are still on this page.",
    whatYouCanIgnore: "You don’t need to restart setup or reconnect anything.",
  };
}

export function recoveryRecommendationUnavailable(): RecoveryMessage {
  return {
    title: "Recommendations aren’t available right now",
    whatHappened: "I couldn’t load the latest recommendation list.",
    workSafe: "Your previous decisions and drafts are unchanged.",
    whatYouCanDo: "Refresh this page shortly, or continue from Approvals and Library.",
    whatYouCanIgnore: "Publishing and Results still work with what you’ve already approved.",
    href: "/dashboard/library",
    ctaLabel: "Open Library",
  };
}

/**
 * Build a lightweight “since last visit” list from facts already on the page.
 * Does not invent counts or fetch new data.
 */
export function buildSinceLastVisitItems(input: {
  thisWeek: string[];
  celebrations?: string[];
  pendingApprovals: number;
  publishFailures: number;
  openRecommendations: number;
  publishingReady: number;
}): SinceLastVisitItem[] {
  const items: SinceLastVisitItem[] = [];

  for (const [index, line] of input.thisWeek.slice(0, 4).entries()) {
    items.push({ id: `week-${index}`, text: line });
  }

  for (const [index, line] of (input.celebrations ?? []).slice(0, 2).entries()) {
    items.push({ id: `celeb-${index}`, text: line });
  }

  if (input.pendingApprovals > 0) {
    items.push({
      id: "pending-approvals",
      text: `${input.pendingApprovals} item${input.pendingApprovals === 1 ? "" : "s"} waiting for your opinion`,
      href: "/dashboard/approvals",
    });
  }

  if (input.publishFailures > 0) {
    items.push({
      id: "publish-failures",
      text: `${input.publishFailures} publish attempt${input.publishFailures === 1 ? "" : "s"} need a retry`,
      href: "/dashboard/publishing",
    });
  } else if (input.publishingReady > 0) {
    items.push({
      id: "publishing-ready",
      text: `${input.publishingReady} approved item${input.publishingReady === 1 ? "" : "s"} ready to publish`,
      href: "/dashboard/publishing",
    });
  }

  if (input.openRecommendations > 0 && input.pendingApprovals === 0) {
    items.push({
      id: "open-recs",
      text: `${input.openRecommendations} recommendation${input.openRecommendations === 1 ? "" : "s"} available to review`,
      href: "/dashboard/marketing-recommendations",
    });
  }

  // De-dupe by text
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}

export function buildMilestones(input: {
  hasBusinessProfile: boolean;
  hasMarketingPlan: boolean;
  hasPublishedContent: boolean;
  hasGoogleSync: boolean;
  hasCompletedRecommendation: boolean;
}): MilestonePresentation[] {
  const milestones: MilestonePresentation[] = [];

  if (input.hasBusinessProfile) {
    milestones.push({
      kind: "first_profile",
      title: "Business profile in place",
      detail: "I have the basics about your business to work from.",
      href: "/dashboard/ai-profile",
      ctaLabel: "View profile",
    });
  }
  if (input.hasMarketingPlan) {
    milestones.push({
      kind: "first_marketing_plan",
      title: "Marketing plan ready",
      detail: "There’s a living plan guiding what we work on together.",
      href: "/dashboard/marketing-plan",
      ctaLabel: "View plan",
    });
  }
  if (input.hasPublishedContent) {
    milestones.push({
      kind: "first_published_content",
      title: "First content published",
      detail: "You’ve completed the path from draft → approve → publish.",
      href: "/dashboard/results",
      ctaLabel: "See results",
    });
  }
  if (input.hasGoogleSync) {
    milestones.push({
      kind: "first_google_sync",
      title: "Google Profile connected",
      detail: "Local posts and reviews can flow through with your approval.",
      href: "/dashboard/google-business-profile",
      ctaLabel: "Open Google Profile",
    });
  }
  if (input.hasCompletedRecommendation) {
    milestones.push({
      kind: "first_completed_recommendation",
      title: "Recommendation completed",
      detail: "You finished a recommended marketing step — momentum counts.",
      href: "/dashboard/marketing-recommendations",
      ctaLabel: "See recommendations",
    });
  }

  return milestones;
}

export function dashboardAwareness(input: {
  pendingApprovals: number;
  publishFailures: number;
  primaryActionKind: string;
}): AwarenessPresentation {
  if (input.publishFailures > 0) return awarenessPresentation("attention_needed");
  if (input.pendingApprovals > 0 || input.primaryActionKind !== "none") {
    return awarenessPresentation("waiting_on_you");
  }
  return awarenessPresentation("all_caught_up");
}

export const LAST_VISIT_STORAGE_KEY = "ajn.customer.last_dashboard_visit_at";
export const MILESTONE_SEEN_STORAGE_KEY = "ajn.customer.milestones_seen";
