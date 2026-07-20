/**
 * Pure Marketing Memory composition helpers for Marketing Director.
 * Deterministic, side-effect free — no scoring engine, no LLM, no DB.
 *
 * Precedence when ordering among already-ranked candidates (architecture §16):
 * 1. Compliance / safety — handled outside this module (existing rails)
 * 2. Customer prohibitions (explicit prohibit_action / disabled factors for context)
 * 3. Explicit customer preferences (preferred recommended_action_type)
 * 4. Active goals — informational in rationale only (not a candidate scorer)
 * 5. Strong learnings
 * 6. Developing learnings
 * 7. Early learnings
 * 8. Original caller order (stable tie-break)
 *
 * Marketing Memory never invents candidates; it only reorders / defers among the
 * existing recommendation package and adjusts seasonal context consideration.
 */

import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";
import type {
  MarketingDirectorCandidate,
  MarketingDirectorMemoryContext,
} from "@/lib/marketing-director/types";

const PROHIBIT_ACTION_FACTOR = "prohibit_action";
const PREFER_ACTION_FACTOR = "recommended_action_type";

export type MemoryOrderedCandidates = {
  ordered: MarketingDirectorCandidate[];
  /** Candidates moved behind due to prohibition (still deferred, never dropped). */
  prohibitedIds: string[];
  memoryContext: MarketingDirectorMemoryContext;
};

function actionKey(candidate: MarketingDirectorCandidate): string {
  return (candidate.actionType ?? "").trim();
}

function isProhibitedAction(
  candidate: MarketingDirectorCandidate,
  evidence: MarketingMemoryEvidencePackage
): boolean {
  const key = actionKey(candidate);
  if (!key) return false;
  return evidence.preferences.some(
    (preference) =>
      preference.factorType === PROHIBIT_ACTION_FACTOR && preference.factorValue === key
  );
}

function isPreferredAction(
  candidate: MarketingDirectorCandidate,
  evidence: MarketingMemoryEvidencePackage
): boolean {
  const key = actionKey(candidate);
  if (!key) return false;
  return evidence.preferences.some(
    (preference) =>
      preference.factorType === PREFER_ACTION_FACTOR && preference.factorValue === key
  );
}

/**
 * Learning alignment tier — lower is better for primary selection.
 * Preferences are handled in an earlier compare key, so a preferred action always
 * beats any learning tier.
 */
function learningTier(
  candidate: MarketingDirectorCandidate,
  evidence: MarketingMemoryEvidencePackage
): number {
  const key = actionKey(candidate);
  if (!key) return 3;

  const relevant = evidence.learnings.filter(
    (learning) =>
      learning.learningFamily === "recommendation_action_outcome" &&
      learning.subjectKey === key &&
      (learning.direction === "positive" || learning.direction === "negative")
  );

  if (relevant.length === 0) return 3;

  // Strongest confidence among matching learnings wins the tier selection.
  const strongPos = relevant.some(
    (learning) =>
      learning.confidenceLevel === "strong_pattern" && learning.direction === "positive"
  );
  const strongNeg = relevant.some(
    (learning) =>
      learning.confidenceLevel === "strong_pattern" && learning.direction === "negative"
  );
  const devPos = relevant.some(
    (learning) =>
      learning.confidenceLevel === "developing_pattern" && learning.direction === "positive"
  );
  const devNeg = relevant.some(
    (learning) =>
      learning.confidenceLevel === "developing_pattern" && learning.direction === "negative"
  );
  const earlyPos = relevant.some(
    (learning) =>
      learning.confidenceLevel === "early_signal" && learning.direction === "positive"
  );
  const earlyNeg = relevant.some(
    (learning) =>
      learning.confidenceLevel === "early_signal" && learning.direction === "negative"
  );

  if (strongPos) return 0;
  if (devPos) return 1;
  if (earlyPos) return 2;
  if (earlyNeg) return 4;
  if (devNeg) return 5;
  if (strongNeg) return 6;
  return 3;
}

function buildPrecedenceExplanation(evidence: MarketingMemoryEvidencePackage): string {
  return [
    "compliance_and_safety (external)",
    "customer_prohibitions",
    "explicit_preferences",
    "active_goals",
    "strong_learnings",
    "developing_learnings",
    "early_learnings",
    "market_context",
    "existing_recommendation_package_order",
    "generic_fallback",
    evidence.isColdStart ? "cold_start:no_eligible_memory" : "memory_present",
  ].join(" > ");
}

function buildConfidenceExplanation(
  ordered: MarketingDirectorCandidate[],
  evidence: MarketingMemoryEvidencePackage
): string {
  if (evidence.isColdStart) {
    return "No eligible Marketing Memory preferences or learnings; decision uses existing signals only.";
  }
  const top = ordered[0];
  if (!top) {
    return "Memory consulted; no recommendation candidates in this cycle.";
  }
  if (isPreferredAction(top, evidence)) {
    return `Primary aligns with explicit customer preference for ${actionKey(top)}.`;
  }
  const tier = learningTier(top, evidence);
  if (tier === 0) return `Primary supported by a strong historical pattern for ${actionKey(top)}.`;
  if (tier === 1) return `Primary supported by a developing pattern for ${actionKey(top)}.`;
  if (tier === 2) return `Primary supported by an early signal for ${actionKey(top)}.`;
  if (tier >= 4) return `Primary selected despite weaker historical pattern for ${actionKey(top)} (preferences/order still govern).`;
  return "Primary follows the existing recommendation package order after memory filters.";
}

/**
 * Stable, deterministic reorder of caller-ranked candidates under memory precedence.
 * Never drops a candidate — prohibited ones move to the end (still deferred).
 */
export function orderCandidatesWithMemory(
  candidates: MarketingDirectorCandidate[],
  evidence: MarketingMemoryEvidencePackage | null | undefined
): MemoryOrderedCandidates {
  if (!evidence || evidence.isColdStart || candidates.length === 0) {
    const memoryContext: MarketingDirectorMemoryContext = evidence
      ? {
          preferencesApplied: [],
          learningsConsidered: evidence.learnings.map((learning) => learning.summary),
          contextConsidered: evidence.marketContextSignals.map((signal) => signal.title),
          ignoredLearnings: evidence.ignoredLearnings,
          ignoredPreferences: evidence.ignoredPreferences,
          precedenceExplanation: buildPrecedenceExplanation(evidence),
          confidenceExplanation: buildConfidenceExplanation(candidates, evidence),
          appliedPreferenceIds: [],
          consideredLearningIds: evidence.learnings.map((learning) => learning.id),
        }
      : {
          preferencesApplied: [],
          learningsConsidered: [],
          contextConsidered: [],
          ignoredLearnings: [],
          ignoredPreferences: [],
          precedenceExplanation: "no_memory_evidence",
          confidenceExplanation:
            "No Marketing Memory evidence provided; decision uses existing signals only.",
          appliedPreferenceIds: [],
          consideredLearningIds: [],
        };

    return { ordered: [...candidates], prohibitedIds: [], memoryContext };
  }

  const indexed = candidates.map((candidate, index) => ({ candidate, index }));
  const prohibitedIds: string[] = [];

  indexed.sort((a, b) => {
    const prohibA = isProhibitedAction(a.candidate, evidence) ? 1 : 0;
    const prohibB = isProhibitedAction(b.candidate, evidence) ? 1 : 0;
    if (prohibA !== prohibB) return prohibA - prohibB;

    const prefA = isPreferredAction(a.candidate, evidence) ? 0 : 1;
    const prefB = isPreferredAction(b.candidate, evidence) ? 0 : 1;
    if (prefA !== prefB) return prefA - prefB;

    const learnA = learningTier(a.candidate, evidence);
    const learnB = learningTier(b.candidate, evidence);
    if (learnA !== learnB) return learnA - learnB;

    return a.index - b.index;
  });

  for (const entry of indexed) {
    if (isProhibitedAction(entry.candidate, evidence)) {
      prohibitedIds.push(entry.candidate.id);
    }
  }

  const ordered = indexed.map((entry) => entry.candidate);
  const appliedPreferenceRows = evidence.preferences.filter(
    (preference) =>
      preference.factorType === PROHIBIT_ACTION_FACTOR ||
      preference.factorType === PREFER_ACTION_FACTOR ||
      preference.preferenceType === "context_category_toggle" ||
      preference.preferenceType === "publishing_day_restriction"
  );
  const appliedPreferences = appliedPreferenceRows.map((preference) => preference.instructionText);

  const memoryContext: MarketingDirectorMemoryContext = {
    preferencesApplied: appliedPreferences,
    learningsConsidered: evidence.learnings.map((learning) => learning.summary),
    contextConsidered: evidence.marketContextSignals.map((signal) => signal.title),
    ignoredLearnings: evidence.ignoredLearnings,
    ignoredPreferences: evidence.ignoredPreferences,
    precedenceExplanation: buildPrecedenceExplanation(evidence),
    confidenceExplanation: buildConfidenceExplanation(ordered, evidence),
    appliedPreferenceIds: appliedPreferenceRows.map((preference) => preference.id),
    consideredLearningIds: evidence.learnings.map((learning) => learning.id),
  };

  return { ordered, prohibitedIds, memoryContext };
}

/**
 * Suppress seasonal opportunity copy when it depends on a customer-disabled context
 * category (e.g. political_civic). Uses category tokens and signal titles — never
 * invents a new seasonal detector.
 */
export function effectiveSeasonalHint(
  seasonalHint: string | null,
  evidence: MarketingMemoryEvidencePackage | null | undefined
): string | null {
  if (!seasonalHint) return null;
  if (!evidence || evidence.disabledContextTypes.length === 0) return seasonalHint;

  const lowered = seasonalHint.toLowerCase();
  for (const category of evidence.disabledContextTypes) {
    const token = category.replaceAll("_", " ");
    if (lowered.includes(token) || lowered.includes(category.replaceAll("_", ""))) {
      return null;
    }
    // Common aliases
    if (category === "political_civic" && (lowered.includes("election") || lowered.includes("civic"))) {
      return null;
    }
    if (category === "sports_entertainment" && (lowered.includes("game") || lowered.includes("sports"))) {
      return null;
    }
  }

  return seasonalHint;
}

/** Customer-safe memory lines for rationale enrichment — never scores or weights. */
export function buildMemoryRationaleLines(
  top: MarketingDirectorCandidate | undefined,
  evidence: MarketingMemoryEvidencePackage | null | undefined
): string[] {
  if (!evidence || evidence.isColdStart || !top) return [];

  const lines: string[] = [];
  const key = actionKey(top);

  const preference = evidence.preferences.find(
    (item) =>
      (item.factorType === PREFER_ACTION_FACTOR || item.factorType === PROHIBIT_ACTION_FACTOR) &&
      item.factorValue === key
  );
  if (preference) {
    lines.push(`You've told us: ${preference.instructionText}`);
  }

  const learning = evidence.learnings.find(
    (item) =>
      item.learningFamily === "recommendation_action_outcome" &&
      item.subjectKey === key &&
      item.direction === "positive"
  );
  if (learning) {
    const prefix =
      learning.confidenceLevel === "strong_pattern"
        ? "Historically"
        : learning.confidenceLevel === "developing_pattern"
          ? "We've noticed"
          : "We've noticed";
    lines.push(`${prefix}: ${learning.summary}`);
  }

  if (evidence.activeGoals.length > 0) {
    lines.push(`Active goals still in view: ${evidence.activeGoals.slice(0, 2).join("; ")}.`);
  }

  return lines;
}
