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
  pending: { label: "Needs your opinion", description: "Waiting for your approval.", tone: "warning" },
  awaiting_approval: {
    label: "Needs your opinion",
    description: "Waiting for your approval.",
    tone: "warning",
  },
  approved: { label: "Approved", description: "Approved and ready for publishing.", tone: "success" },
  ready: {
    label: "Approved · Ready",
    description: "Approved and ready to publish or schedule.",
    tone: "success",
  },
  queued: { label: "Queued", description: "In line and waiting to start publishing.", tone: "info" },
  scheduled: {
    label: "Waiting · Scheduled",
    description: "Waiting for its scheduled publish time.",
    tone: "info",
  },
  publishing: { label: "Publishing", description: "Publish is in progress — please wait.", tone: "info" },
  verified: {
    label: "Published · Confirmed",
    description: "Live and confirmed on the destination.",
    tone: "success",
  },
  published: { label: "Published", description: "Successfully published.", tone: "success" },
  failed: {
    label: "Failed · Retry available",
    description: "Publishing failed and may need a retry.",
    tone: "danger",
  },
  retrying: {
    label: "Retry available",
    description: "A retry is available or in progress.",
    tone: "warning",
  },
  cancelled: { label: "Cancelled", description: "Publishing was cancelled.", tone: "muted" },
};

/**
 * [Claude review] Keys must exactly match RecommendationStatuses
 * (lib/marketing-decisions/types.ts): open | in_progress | dismissed | completed |
 * superseded. A prior version of this map used invented key names (active, new,
 * approved, applied, rejected, expired) that do not exist anywhere in the real enum —
 * "open", the single most common status, was missing entirely and would have silently
 * fallen through to the generic humanized fallback (title-cased raw value, neutral tone)
 * instead of an intentional customer label. Caught because this map is not yet wired
 * into any production page (verified via grep) — fixed before a future caller could
 * inherit the bug.
 */
const RECOMMENDATION_STATUS: Record<string, CustomerStatusPresentation> = {
  open: { label: "New", description: "Open recommendation awaiting action.", tone: "info" },
  in_progress: { label: "In progress", description: "Recommendation work is underway.", tone: "info" },
  completed: { label: "Completed", description: "Recommendation work finished.", tone: "success" },
  dismissed: { label: "Dismissed", description: "Recommendation was dismissed.", tone: "muted" },
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

/**
 * [Claude review] This map is fed by two different real enums:
 * ExperimentConfidenceLevels (insufficient | early | moderate | strong) and, on the
 * live Decision Intelligence page, DecisionEvidenceConfidenceState
 * (lib/decision-intelligence/types.ts: strong | developing | early | inconclusive |
 * not_applicable) via decision-intelligence-page.tsx's
 * confidenceLabel(trace.confidenceState). "not_applicable" is the value assigned to
 * every recommendation/campaign evidence trace (evidenceTrace.ts) — i.e. the majority
 * of real traces on that page — and was missing entirely, so most confidence badges
 * were silently falling through to the generic humanized fallback ("Not Applicable",
 * neutral tone) instead of an intentional label. "developing" and "inconclusive" were
 * missing too. Added all three so the map now covers the full union of both real
 * enums.
 */
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
  developing: {
    label: "Developing signal",
    description: "A pattern is emerging but is not yet strong.",
    tone: "info",
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
  inconclusive: {
    label: "Inconclusive",
    description: "Result could not be attributed with confidence.",
    tone: "muted",
  },
  not_applicable: {
    label: "Not scored",
    description: "Confidence scoring does not apply to this evidence.",
    tone: "neutral",
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
