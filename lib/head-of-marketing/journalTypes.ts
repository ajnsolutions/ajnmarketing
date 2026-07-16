/**
 * Internal journal categories — not shown as customer taxonomy.
 * Narrative is primary; categories support future filtering/styles.
 */
export type JournalCategory =
  | "learning"
  | "planning"
  | "publishing"
  | "monitoring"
  | "reviews"
  | "competitors"
  | "market_trends"
  | "website"
  | "community"
  | "search_visibility"
  | "marketing_health";

/**
 * Architecture hook for future management styles.
 * Hands-On may show more entries; Trusted may show fewer, higher-level summaries.
 */
export type JournalDetailSupport = {
  supportedStyles: Array<"hands_on" | "weekly" | "monthly" | "trusted">;
  /** Active detail level today — not yet driven by persisted style. */
  activeDetail: "standard";
  note: string;
};

export type HeadOfMarketingJournalEntry = {
  /** Customer-facing day label, e.g. Monday */
  dayLabel: string;
  /** Short paragraphs in Head of Marketing voice */
  paragraphs: string[];
  /** Internal only */
  category: JournalCategory;
};

export type HeadOfMarketingJournal = {
  intro: string;
  entries: HeadOfMarketingJournalEntry[];
  closing: string | null;
  detail: JournalDetailSupport;
};
