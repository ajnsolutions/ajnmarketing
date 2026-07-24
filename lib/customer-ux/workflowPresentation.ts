/**
 * Phase 4B — plain-language workflow status guides for everyday pilot use.
 * Presentation only; does not change lifecycle, ranking, or publishing rules.
 */

import type { StatusTone } from "@/lib/customer-ux/statusVocabulary";

export type WorkflowStatusGuide = {
  /** Short badge / filter label */
  label: string;
  /** What is happening right now */
  happening: string;
  /** Whether the customer needs to act */
  needAction: string;
  /** What happens next */
  next: string;
  tone: StatusTone;
};

const QUEUE_STATUS: Record<string, WorkflowStatusGuide> = {
  ready: {
    label: "Approved · Ready",
    happening: "This piece is approved and ready to go live.",
    needAction: "Publish now, or schedule a time — your choice.",
    next: "Once you publish or schedule, I’ll handle the send.",
    tone: "success",
  },
  scheduled: {
    label: "Waiting · Scheduled",
    happening: "This piece is waiting for its scheduled publish time.",
    needAction: "Nothing right now unless you want to change the time.",
    next: "It will publish automatically at the scheduled time.",
    tone: "info",
  },
  published: {
    label: "Published",
    happening: "This piece is live.",
    needAction: "Nothing required.",
    next: "Results will show progress after enough activity.",
    tone: "success",
  },
  failed: {
    label: "Failed · Retry available",
    happening: "Publishing didn’t finish successfully.",
    needAction: "Retry when you’re ready, or adjust and try again.",
    next: "A successful retry moves it back toward published.",
    tone: "danger",
  },
};

const JOB_STATUS: Record<string, WorkflowStatusGuide> = {
  queued: {
    label: "Queued",
    happening: "This update is in line and waiting to start.",
    needAction: "Nothing right now.",
    next: "Publishing will begin shortly.",
    tone: "info",
  },
  scheduled: {
    label: "Waiting",
    happening: "This update is waiting for its scheduled time.",
    needAction: "Nothing right now unless you cancel or reschedule.",
    next: "It will start publishing at the scheduled time.",
    tone: "info",
  },
  publishing: {
    label: "Publishing",
    happening: "I’m sending this update live now.",
    needAction: "Please wait — no action needed.",
    next: "I’ll confirm it went live, then mark it published.",
    tone: "info",
  },
  verified: {
    label: "Published · Confirmed",
    happening: "This update is live and confirmed.",
    needAction: "Nothing required.",
    next: "Check Results for what’s improving.",
    tone: "success",
  },
  published: {
    label: "Published",
    happening: "This update is live.",
    needAction: "Nothing required.",
    next: "I’ll keep confirming delivery where I can.",
    tone: "success",
  },
  retrying: {
    label: "Retry available",
    happening: "A previous attempt didn’t finish — a retry is available or in progress.",
    needAction: "You can retry if it hasn’t started again yet.",
    next: "A successful retry completes publishing.",
    tone: "warning",
  },
  failed: {
    label: "Failed · Retry available",
    happening: "Publishing didn’t finish successfully.",
    needAction: "Retry when you’re ready.",
    next: "After a successful retry, this moves to published.",
    tone: "danger",
  },
  cancelled: {
    label: "Cancelled",
    happening: "This publish was cancelled before it went live.",
    needAction: "Nothing required unless you want to publish again from the queue.",
    next: "You can start a fresh publish from Ready items.",
    tone: "muted",
  },
};

const APPROVAL_STATUS: Record<string, WorkflowStatusGuide> = {
  pending: {
    label: "Needs your opinion",
    happening: "A draft is waiting for your review.",
    needAction: "Approve, edit, or reject.",
    next: "Approved items can move to publishing as a separate step.",
    tone: "warning",
  },
  approved: {
    label: "Approved",
    happening: "You approved this draft.",
    needAction: "Add it to publishing when you’re ready (approve ≠ publish).",
    next: "Publishing prepares it to go live.",
    tone: "success",
  },
  rejected: {
    label: "Rejected",
    happening: "This draft won’t go live.",
    needAction: "Optional: regenerate or create a new draft.",
    next: "Rejected items stay out of the publishing queue.",
    tone: "danger",
  },
  published: {
    label: "Published",
    happening: "This content made it live.",
    needAction: "Nothing required.",
    next: "See Results for what’s working.",
    tone: "success",
  },
};

function lookup(
  map: Record<string, WorkflowStatusGuide>,
  raw: string | null | undefined,
): WorkflowStatusGuide {
  if (!raw) {
    return {
      label: "Unknown",
      happening: "Status isn’t available right now.",
      needAction: "Refresh the page in a moment.",
      next: "Status will update when available.",
      tone: "muted",
    };
  }
  const key = raw.trim().toLowerCase();
  return (
    map[key] ?? {
      label: key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      happening: "Status updated.",
      needAction: "Check this item if anything looks off.",
      next: "Continue when you’re ready.",
      tone: "neutral",
    }
  );
}

export function publishingQueueStatusGuide(status: string): WorkflowStatusGuide {
  return lookup(QUEUE_STATUS, status);
}

export function publishingJobStatusGuide(status: string): WorkflowStatusGuide {
  return lookup(JOB_STATUS, status);
}

export function approvalStatusGuide(status: string): WorkflowStatusGuide {
  return lookup(APPROVAL_STATUS, status);
}

/** Customer-safe badge label for publishing job statuses (no engine jargon). */
export function customerPublishingJobLabel(status: string): string {
  return publishingJobStatusGuide(status).label;
}

/** Customer-safe badge label for publishing queue statuses. */
export function customerPublishingQueueLabel(status: string): string {
  return publishingQueueStatusGuide(status).label;
}

export type AttentionSummary = {
  headline: string;
  detail: string;
  count: number;
  href?: string;
  ctaLabel?: string;
};

/**
 * One-line “what needs me today?” for Approval Center.
 */
export function approvalAttentionSummary(pendingCount: number): AttentionSummary {
  if (pendingCount <= 0) {
    return {
      headline: "You’re caught up for today",
      detail: "Nothing needs your opinion right now. I’ll bring new drafts here when they’re ready.",
      count: 0,
      href: "/dashboard/content/generator",
      ctaLabel: "Create something new",
    };
  }
  if (pendingCount === 1) {
    return {
      headline: "1 item needs your attention today",
      detail: "Review it when you have a moment — nothing goes live until you approve.",
      count: 1,
      href: "/dashboard/approvals?view=pending",
      ctaLabel: "Review now",
    };
  }
  return {
    headline: `${pendingCount} items need your attention today`,
    detail: "Start with the queue below. Approving means the draft is ready — publishing is still a separate step.",
    count: pendingCount,
    href: "/dashboard/approvals?view=pending",
    ctaLabel: "Review queue",
  };
}

export type LibraryZone = {
  id: "drafts" | "awaiting" | "publishing" | "published" | "history";
  label: string;
  description: string;
  href: string;
};

/** Orientation map for Content Library — where things live. */
export const LIBRARY_ZONES: readonly LibraryZone[] = [
  {
    id: "drafts",
    label: "Drafts & new work",
    description: "Fresh drafts start in Create, then come here before anything goes live.",
    href: "/dashboard/content/generator",
  },
  {
    id: "awaiting",
    label: "Needs your opinion",
    description: "Pending reviews live in Approvals (This Week).",
    href: "/dashboard/approvals",
  },
  {
    id: "publishing",
    label: "Preparing to publish",
    description: "Approved work waiting to go live lives in Publishing.",
    href: "/dashboard/publishing",
  },
  {
    id: "published",
    label: "Published",
    description: "Live updates appear in Library history and Results.",
    href: "/dashboard/results",
  },
  {
    id: "history",
    label: "History",
    description: "Past published items stay here so you can revisit what went out.",
    href: "/dashboard/library",
  },
] as const;
