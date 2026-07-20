/**
 * Customer-facing status vocabulary — never expose raw DB enums on product UI.
 * Presentation only; does not change lifecycle or ranking logic.
 */

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

export type CustomerStatusPresentation = {
  label: string;
  /** Short phrase for screen readers / tooltips when color is also used. */
  description: string;
  tone: StatusTone;
};

const FALLBACK: CustomerStatusPresentation = {
  label: "Unknown",
  description: "Status is not available.",
  tone: "muted",
};

function titleCaseWords(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const CAMPAIGN_STATUS: Record<string, CustomerStatusPresentation> = {
  draft: { label: "Draft", description: "Campaign plan is being prepared.", tone: "muted" },
  planned: { label: "Planned", description: "Campaign steps are planned.", tone: "info" },
  approved: { label: "Approved", description: "Campaign is approved to proceed.", tone: "success" },
  scheduled: { label: "Scheduled", description: "Campaign steps have scheduled dates.", tone: "info" },
  in_progress: { label: "Active", description: "Campaign work is in progress.", tone: "info" },
  completed: { label: "Completed", description: "Campaign steps are finished.", tone: "success" },
  measured: { label: "Measuring", description: "Campaign outcomes are being reviewed.", tone: "info" },
  archived: { label: "Archived", description: "Campaign is archived for history.", tone: "muted" },
};

const EXPERIMENT_STATUS: Record<string, CustomerStatusPresentation> = {
  draft: { label: "Draft", description: "Experiment record is not yet proposed.", tone: "muted" },
  proposed: { label: "Proposed", description: "Awaiting your approval to run.", tone: "warning" },
  approved: { label: "Approved", description: "Approved and ready to run.", tone: "success" },
  running: { label: "Running", description: "Experiment measurement window is open.", tone: "info" },
  measuring: { label: "Measuring", description: "Results are being calculated.", tone: "info" },
  completed: { label: "Completed", description: "Experiment measurement finished.", tone: "success" },
  archived: { label: "Archived", description: "Experiment is archived for history.", tone: "muted" },
};

const PUBLISHING_STATUS: Record<string, CustomerStatusPresentation> = {
  draft: { label: "Draft", description: "Content is still a draft.", tone: "muted" },
  pending: { label: "Awaiting approval", description: "Waiting for your approval.", tone: "warning" },
  awaiting_approval: {
    label: "Awaiting approval",
    description: "Waiting for your approval.",
    tone: "warning",
  },
  approved: { label: "Approved", description: "Approved and ready for publishing.", tone: "success" },
  queued: { label: "Queued", description: "Queued for publishing.", tone: "info" },
  scheduled: { label: "Scheduled", description: "Scheduled for a future publish time.", tone: "info" },
  publishing: { label: "Publishing", description: "Publish is in progress.", tone: "info" },
  published: { label: "Published", description: "Successfully published.", tone: "success" },
  failed: { label: "Failed", description: "Publishing failed and may need a retry.", tone: "danger" },
  retrying: { label: "Retrying", description: "A retry is in progress.", tone: "warning" },
  cancelled: { label: "Cancelled", description: "Publishing was cancelled.", tone: "muted" },
};

const RECOMMENDATION_STATUS: Record<string, CustomerStatusPresentation> = {
  active: { label: "New", description: "Open recommendation awaiting action.", tone: "info" },
  new: { label: "New", description: "Open recommendation awaiting action.", tone: "info" },
  approved: { label: "Approved", description: "Recommendation was approved.", tone: "success" },
  applied: { label: "In progress", description: "Recommendation work is underway.", tone: "info" },
  in_progress: { label: "In progress", description: "Recommendation work is underway.", tone: "info" },
  completed: { label: "Completed", description: "Recommendation work finished.", tone: "success" },
  dismissed: { label: "Dismissed", description: "Recommendation was dismissed.", tone: "muted" },
  rejected: { label: "Dismissed", description: "Recommendation was dismissed.", tone: "muted" },
  expired: { label: "Expired", description: "Recommendation is no longer current.", tone: "muted" },
  superseded: { label: "Superseded", description: "A newer recommendation replaced this one.", tone: "muted" },
};

const MEMORY_KIND: Record<string, CustomerStatusPresentation> = {
  observation: {
    label: "Observation",
    description: "A recorded fact from marketing activity.",
    tone: "neutral",
  },
  learning: {
    label: "Developing learning",
    description: "A pattern we are watching over time.",
    tone: "info",
  },
  developing_learning: {
    label: "Developing learning",
    description: "A pattern we are watching over time.",
    tone: "info",
  },
  strong_learning: {
    label: "Strong learning",
    description: "A more consistent pattern from repeated evidence.",
    tone: "success",
  },
  preference: {
    label: "Preference",
    description: "A standing preference for how we market.",
    tone: "info",
  },
  temporary_override: {
    label: "Temporary override",
    description: "A short-term customer override.",
    tone: "warning",
  },
  override: {
    label: "Temporary override",
    description: "A short-term customer override.",
    tone: "warning",
  },
  superseded: {
    label: "Superseded",
    description: "Replaced by newer evidence or preference.",
    tone: "muted",
  },
  prohibition: {
    label: "Do not use",
    description: "Explicitly excluded from future decisions.",
    tone: "danger",
  },
};

const CONFIDENCE: Record<string, CustomerStatusPresentation> = {
  insufficient: {
    label: "Insufficient data",
    description: "Not enough data to draw a conclusion.",
    tone: "muted",
  },
  early: {
    label: "Early signal",
    description: "Early signal only — treat cautiously.",
    tone: "warning",
  },
  moderate: {
    label: "Moderate signal",
    description: "Moderate confidence based on available data.",
    tone: "info",
  },
  strong: {
    label: "Strong signal",
    description: "Stronger confidence based on available data.",
    tone: "success",
  },
  unknown: {
    label: "Uncertain",
    description: "Confidence cannot be determined yet.",
    tone: "muted",
  },
};

const EVIDENCE_TYPE: Record<string, CustomerStatusPresentation> = {
  observation: MEMORY_KIND.observation!,
  learning: MEMORY_KIND.learning!,
  preference: MEMORY_KIND.preference!,
  override: MEMORY_KIND.override!,
  prohibition: MEMORY_KIND.prohibition!,
  campaign: {
    label: "Campaign",
    description: "Linked campaign execution evidence.",
    tone: "neutral",
  },
  experiment: {
    label: "Experiment",
    description: "Linked experiment measurement evidence.",
    tone: "neutral",
  },
  recommendation: {
    label: "Recommendation",
    description: "Linked recommendation evidence.",
    tone: "neutral",
  },
  analytics_snapshot: {
    label: "Results snapshot",
    description: "Linked performance snapshot.",
    tone: "neutral",
  },
};

function lookup(
  map: Record<string, CustomerStatusPresentation>,
  raw: string | null | undefined,
): CustomerStatusPresentation {
  if (!raw) return FALLBACK;
  const key = raw.trim().toLowerCase();
  return map[key] ?? { label: titleCaseWords(key), description: titleCaseWords(key), tone: "neutral" };
}

export function campaignStatusLabel(status: string): CustomerStatusPresentation {
  return lookup(CAMPAIGN_STATUS, status);
}

export function experimentStatusLabel(status: string): CustomerStatusPresentation {
  return lookup(EXPERIMENT_STATUS, status);
}

export function publishingStatusLabel(status: string): CustomerStatusPresentation {
  return lookup(PUBLISHING_STATUS, status);
}

export function recommendationStatusLabel(status: string): CustomerStatusPresentation {
  return lookup(RECOMMENDATION_STATUS, status);
}

export function memoryKindLabel(kind: string): CustomerStatusPresentation {
  return lookup(MEMORY_KIND, kind);
}

export function confidenceLabel(level: string): CustomerStatusPresentation {
  return lookup(CONFIDENCE, level);
}

export function evidenceTypeLabel(type: string): CustomerStatusPresentation {
  return lookup(EVIDENCE_TYPE, type);
}

/** Generic humanizer for unmatched closed vocabularies. */
export function humanizeStatusToken(value: string): string {
  return titleCaseWords(value);
}
