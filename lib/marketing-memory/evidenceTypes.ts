/**
 * Marketing Memory evidence package — narrow, pre-filtered facts for Marketing Director
 * consumption (Phase 4). See docs/MARKETING_DIRECTOR_MEMORY_INTEGRATION.md.
 *
 * Pure types only (no server-only gate) so the Marketing Director composer and unit tests
 * can import them without pulling persistence. The async builder lives in evidencePackage.ts.
 */

export type MarketingMemoryLearningSummary = {
  id: string;
  learningFamily: "timing_performance" | "recommendation_action_outcome";
  subjectKey: string;
  timeDimension: string | null;
  direction: "positive" | "negative" | "neutral" | "inconclusive";
  confidenceLevel: "early_signal" | "developing_pattern" | "strong_pattern";
  status: string;
  /** Customer-safe correlation language from the Learning row — never raw scores. */
  summary: string;
};

export type MarketingMemoryPreferenceEvidence = {
  id: string;
  preferenceType: string;
  factorType: string | null;
  factorValue: string | null;
  instructionText: string;
  source: string;
  activeUntil: string | null;
};

export type MarketingMemoryIgnoredItem = {
  id: string;
  reason: string;
};

export type MarketingMemoryContextSignalSummary = {
  id: string;
  category: string;
  title: string;
};

/**
 * Deterministic evidence package. Marketing Director may consult this; it never scores
 * or chooses recommendations on its own.
 */
export type MarketingMemoryEvidencePackage = {
  businessProfileId: string;
  /** Active, non-expired explicit preferences — precedence-sorted. */
  preferences: MarketingMemoryPreferenceEvidence[];
  /** Live learnings eligible to influence (not superseded/archived/inconclusive). */
  learnings: MarketingMemoryLearningSummary[];
  ignoredLearnings: MarketingMemoryIgnoredItem[];
  ignoredPreferences: MarketingMemoryIgnoredItem[];
  disabledContextTypes: string[];
  /** Market context signals after disabled-category filtering. */
  marketContextSignals: MarketingMemoryContextSignalSummary[];
  /** Active business goals (from existing profile/plan — referenced, not duplicated). */
  activeGoals: string[];
  /**
   * True when there is no eligible preference and no eligible learning — Marketing
   * Director must behave exactly as before memory existed.
   */
  isColdStart: boolean;
  evaluatedAt: string;
};
