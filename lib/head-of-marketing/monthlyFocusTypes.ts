/**
 * Architecture hook for future planning horizons.
 * Monthly Focus is the living priority today; Quarterly/Annual can share this shape later.
 */
export type FocusHorizonSupport = {
  activeHorizon: "monthly";
  supportedHorizons: Array<"monthly" | "quarterly" | "annual">;
  note: string;
};

/**
 * Management styles will later change how much Focus detail is shown.
 * The Focus itself remains the shared anchor.
 */
export type FocusStyleSupport = {
  supportedStyles: Array<"hands_on" | "weekly" | "monthly" | "trusted">;
  note: string;
};

export type MonthlyFocusPriority = {
  /** Customer-facing priority line */
  label: string;
  /** Optional plain-English why — kept short */
  why?: string;
};

export type MonthlyFocus = {
  title: "This Month's Focus";
  intro: string;
  priorities: MonthlyFocusPriority[];
  reinforcement: string;
  /** Ties Marketing Health to the focus without guilt */
  progressLine: string;
  successLooksLike: string;
  magicMoment: string | null;
  horizon: FocusHorizonSupport;
  styles: FocusStyleSupport;
  /** True when derived from an existing marketing plan */
  sourcedFromPlan: boolean;
};
