/**
 * Customer-facing activity timeline kinds for the Journal / Recent Activity.
 * Chronological storytelling — not a notification feed.
 */
export type ActivityEventKind =
  | "progress"
  | "completed_work"
  | "observation"
  | "milestone"
  | "recommendation"
  | "celebration"
  | "decision_requested";

/** Why this proactive moment exists — trust hierarchy. */
export type ProactiveMomentPurpose =
  | "celebrate"
  | "reassure"
  | "opportunity"
  | "decision";

export type ProactiveMoment = {
  /** Single primary line shown above the fold */
  message: string;
  purpose: ProactiveMomentPurpose;
  /** Soft customer label, e.g. "Celebration" */
  label: string;
};

export type ProactiveCelebration = {
  message: string;
};

/**
 * Lightweight proactive presence — presentation over existing HoM signals.
 * Never invents urgency or invents facts.
 */
export type ProactivePresence = {
  /** The one moment shown first — progressive disclosure for the rest */
  primary: ProactiveMoment;
  /** Small confidence reinforcements (not gamification) */
  celebrations: ProactiveCelebration[];
  /** Additional calm updates under "More updates" */
  moreUpdates: string[];
};

export const ACTIVITY_EVENT_LABELS: Record<ActivityEventKind, string> = {
  progress: "Progress",
  completed_work: "Completed",
  observation: "Observation",
  milestone: "Milestone",
  recommendation: "Recommendation",
  celebration: "Celebration",
  decision_requested: "Needs your opinion",
};

/** Never use these in customer-facing proactive copy. */
export const PROACTIVE_FORBIDDEN_TERMS = [
  "URGENT",
  "CRITICAL",
  "WARNING",
  "Alert",
  "Action required",
  "Immediately",
] as const;
