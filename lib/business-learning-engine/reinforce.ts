/**
 * Pure pattern reconciliation (Part 2/Part 3) — given the patterns already
 * persisted for a business and a fresh batch of normalized signals, decides
 * which patterns to create and which to reinforce in place. No I/O; the
 * caller (service.ts/persistence.ts) is responsible for actually writing
 * the result. This is the one place new-vs-reinforce logic lives, shared by
 * every provider adapter.
 */

import { computeDecayState, applyDecay } from "@/lib/business-learning-engine/confidence";
import {
  contributingProvidersFromEvidence,
  type BusinessPattern,
  type LearningSignalInput,
  type PatternEvidence,
} from "@/lib/business-learning-engine/types";

export type ReinforcementPlan = {
  /** Patterns unchanged this pass — no signal referenced their key. */
  unchanged: BusinessPattern[];
  /** Existing patterns to update in place (reinforced by a new signal). */
  toReinforce: Array<{ pattern: BusinessPattern; signal: LearningSignalInput }>;
  /** Brand new patterns to insert, one per never-before-seen pattern key. */
  toCreate: LearningSignalInput[];
};

function toEvidence(signal: LearningSignalInput, idx: number): PatternEvidence {
  return {
    id: `evidence_${idx}_${signal.sourceProviderId}`,
    sourceProviderId: signal.sourceProviderId,
    sourceLabel: signal.sourceLabel,
    summary: signal.evidenceSummary,
    occurredAt: signal.occurredAt,
  };
}

/**
 * Decides, for a batch of fresh signals against already-persisted patterns,
 * what to create vs. reinforce. A signal reinforces an existing pattern only
 * when its evidence isn't already present (idempotent — replaying the same
 * signal twice never double-counts reinforcement).
 */
export function planReinforcement(
  existingPatterns: BusinessPattern[],
  signals: LearningSignalInput[],
): ReinforcementPlan {
  const byKey = new Map(existingPatterns.map((p) => [p.patternKey, p]));
  const reinforcedKeys = new Set<string>();
  const toReinforce: ReinforcementPlan["toReinforce"] = [];
  const toCreate: LearningSignalInput[] = [];

  signals.forEach((signal, idx) => {
    const existing = byKey.get(signal.patternKey);
    if (!existing) {
      // Only the first signal for a never-seen key creates it; later
      // signals for the same brand-new key in this same batch reinforce
      // the just-created in-memory placeholder rather than creating twice.
      const alreadyQueued = toCreate.find((s) => s.patternKey === signal.patternKey);
      if (!alreadyQueued) {
        toCreate.push(signal);
      }
      return;
    }

    const evidence = toEvidence(signal, idx);
    const alreadyHasEvidence = existing.evidence.some(
      (e) => e.sourceProviderId === evidence.sourceProviderId && e.summary === evidence.summary,
    );
    if (alreadyHasEvidence) return;

    reinforcedKeys.add(signal.patternKey);
    toReinforce.push({ pattern: existing, signal });
  });

  const unchanged = existingPatterns.filter((p) => !reinforcedKeys.has(p.patternKey));

  return { unchanged, toReinforce, toCreate };
}

/** Builds the new-pattern shape (pre-insert) for a never-before-seen key. */
export function buildNewPattern(signal: LearningSignalInput, now: Date): Omit<BusinessPattern, "id"> {
  const evidence = [toEvidence(signal, 0)];
  const decayState = computeDecayState(now.toISOString(), now);
  return {
    patternKey: signal.patternKey,
    statement: signal.statement,
    direction: signal.direction,
    confidenceLevel: signal.confidence,
    contributingProviders: contributingProvidersFromEvidence(evidence),
    evidence,
    firstObserved: now.toISOString(),
    lastReinforced: now.toISOString(),
    reinforcementCount: 1,
    decayState,
    effectiveConfidence: applyDecay(signal.confidence, decayState),
  };
}

/** Applies one reinforcing signal to an existing pattern (pre-update). */
export function reinforceExistingPattern(
  pattern: BusinessPattern,
  signal: LearningSignalInput,
  now: Date,
): BusinessPattern {
  const evidence = [...pattern.evidence, toEvidence(signal, pattern.evidence.length)];
  const decayState = computeDecayState(now.toISOString(), now);
  // A pattern's own confidence never drops just because a new, weaker
  // signal reinforced it — reinforcement only ever holds or strengthens
  // the stored confidence level; decay (elapsed time, handled separately)
  // is the only thing that lowers it.
  const confidenceLevel = strongerConfidence(pattern.confidenceLevel, signal.confidence);

  return {
    ...pattern,
    statement: pattern.statement,
    direction: pattern.direction,
    confidenceLevel,
    contributingProviders: contributingProvidersFromEvidence(evidence),
    evidence,
    lastReinforced: now.toISOString(),
    reinforcementCount: pattern.reinforcementCount + 1,
    decayState,
    effectiveConfidence: applyDecay(confidenceLevel, decayState),
  };
}

const TIER: Record<BusinessPattern["confidenceLevel"], number> = { low: 1, medium: 2, high: 3 };
function strongerConfidence(
  a: BusinessPattern["confidenceLevel"],
  b: BusinessPattern["confidenceLevel"],
): BusinessPattern["confidenceLevel"] {
  return TIER[a] >= TIER[b] ? a : b;
}
